#!/usr/bin/env python3
"""Start the actual Plugin Feedback backend with a fresh disposable PostgreSQL 15.

This module never edits another clone, the interactive menus or existing databases.
The backend is started from the unified Spanish-main repo with its local certificates
only when all three QA opt-ins and an unused TCP port have been verified.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
import re
from pathlib import Path
import secrets
import signal
import socket
import subprocess
import sys
import time
from threading import Thread
from urllib.request import urlopen
from urllib.error import HTTPError, URLError
import ssl

ROOT = Path(__file__).resolve().parents[2]
HOME = Path.home()
QA = HOME / "qa-feedback-20261110" / "artifacts"
ORIGINAL_QA_ENV = HOME / "qa-feedback-20261110/clean/Plugin-Feedback-Canvas/.env"
PORT = 3000

class SafeAbort(Exception):
    pass

def run(command, *, timeout=30):
    try:
        return subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired as exc:
        raise SafeAbort("Timed-out QA command") from exc

def guard():
    for variable in ("QA_ALLOW_ISOLATED_PLUGIN_BACKEND","PLUGIN_TEST_MODE","PLUGIN_QA_NO_BROWSER"):
        if os.environ.get(variable)!="true":
            raise SafeAbort("Three explicit isolated QA flags are required")
    expected=HOME/"proyectos/Plugin-Feedback-Canvas-feedback-cualitativo"
    if ROOT.resolve()!=expected.resolve():
        raise SafeAbort("The unified Spanish-main clone is mandatory")
    if not ORIGINAL_QA_ENV.is_file() or not ORIGINAL_QA_ENV.resolve().is_relative_to(HOME/"qa-feedback-20261110"):
        raise SafeAbort("Isolated QA configuration not available")
    QA.mkdir(mode=0o700,parents=True,exist_ok=True)
    if QA.is_symlink() or not QA.resolve().is_relative_to(HOME/"qa-feedback-20261110"):
        raise SafeAbort("Invalid QA artifact directory")
    if tcp_bound(PORT):
        raise SafeAbort("Backend port 3000 already occupied; refusing to touch its owner")
    certs = ROOT/"apps/server/certs"
    for filename in ("localhost.pem","localhost-key.pem","session_keys.json"):
        if not (certs/filename).is_file():
            raise SafeAbort("Existing backend TLS/session key file missing")
    ok=run(["node","--input-type=module","-e",
            "import { SSLCertificateGenerator as S } from './apps/server/src/security/SSLCertificateGenerator.js';process.stdout.write(String(S.hasUsableCertificates()))"],
           timeout=20)
    if ok.returncode or ok.stdout.strip()!="true":
        raise SafeAbort("Backend SSL certificate would be regenerated; refusing to alter the clone")

def tcp_bound(port):
    with socket.socket() as conn:
        conn.settimeout(.25)
        return conn.connect_ex(("127.0.0.1",port)) == 0

def labels_ok(resource,owner,kind="container"):
    verb="volume" if kind=="volume" else "container"
    reply=run(["docker",verb,"inspect",resource,"--format","{{json .}}"])
    if reply.returncode:raise SafeAbort("Disposable resource unavailable")
    row=json.loads(reply.stdout)
    labels=row.get("Labels") if kind=="volume" else (row.get("Config") or {}).get("Labels")
    if (labels or {}).get("qa.plugin.owner") != owner or (labels or {}).get("qa.plugin.disposable")!="true":
        raise SafeAbort("Disposable resource does not belong to this experiment")

def free_disposable_host_port():
    # Avoid Docker rootless ephemeral-port collisions with other WSL applications.
    for _ in range(24):
        port=20000+secrets.randbelow(11000)
        with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as candidate:
            try:
                candidate.bind(("127.0.0.1",port))
            except OSError:
                continue
            return port
    raise SafeAbort("No available localhost port for disposable database")

def port_from_docker(container):
    reply=run(["docker","port",container,"5432/tcp"],timeout=15)
    if reply.returncode:raise SafeAbort("No localhost-only PostgreSQL port")
    lines=[line.strip() for line in reply.stdout.splitlines() if line.strip()]
    if len(lines)!=1 or not lines[0].startswith("127.0.0.1:"):
        raise SafeAbort("PostgreSQL port is not restricted to localhost")
    port=int(lines[0].split(":")[-1])
    if not 1024<=port<=65535:raise SafeAbort("Unexpected PostgreSQL port")
    return port

def read_qa_env():
    data={}
    for line in ORIGINAL_QA_ENV.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:continue
        key,value=line.split("=",1)
        if key and key.replace("_","").isalnum():
            data[key]=value.strip().strip("'\"")
    return data

def cert_hashes():
    certs=ROOT/"apps/server/certs"
    return {name:hashlib.sha256((certs/name).read_bytes()).hexdigest()
            for name in ("localhost.pem","localhost-key.pem","session_keys.json")}

def backend_env(port,password,name,canvas_url=None,client_id=None,*,client_secret=None,canvas_internal_url=None):
    qa=read_qa_env()
    # Start from only essential OS paths, not inherited secrets or production DB URLs.
    safe=("PATH","HOME","USER","LANG","TZ","TERM")
    env={key:os.environ[key] for key in safe if key in os.environ}
    # The backend requires a few Canvas QA knobs, not the real admin passwords.
    for key in ("CANVAS_ISSUER","CANVAS_COURSE_ID","CANVAS_API_HOST",
                "CANVAS_ADMIN_EMAIL","CANVAS_BASE_URL","LTI_CLIENT_ID"):
        if qa.get(key):env[key]=qa[key]
    if client_id is not None and (not client_id.isdecimal() or len(client_id)>18):
        raise SafeAbort("Invalid dynamically resolved QA LTI client ID")
    if canvas_url is not None and (
       not (canvas_url.startswith("http://127.0.0.1:") or
            canvas_url.startswith("http://localhost:") or
            canvas_url == "https://localhost:8443")):
        raise SafeAbort("Only localhost Canvas QA URLs are allowed")
    if canvas_url:
        env["CANVAS_BASE_URL"]=canvas_url
        env["CANVAS_ISSUER"]=canvas_url
    if client_id:
        env["LTI_CLIENT_ID"]=client_id
        env["CANVAS_CLIENT_ID"]=client_id
    if client_secret is not None and (not isinstance(client_secret,str) or
                                      len(client_secret)<12 or "\n" in client_secret or "\r" in client_secret):
        raise SafeAbort("Invalid disposable Canvas OAuth client credential")
    if canvas_internal_url is not None:
        from urllib.parse import urlparse
        target=urlparse(canvas_internal_url)
        if (target.scheme!="http" or target.hostname!="127.0.0.1" or
                not target.port or target.port<=1024 or target.port==8080 or
                target.path not in ("", "/") or target.query or target.fragment):
            raise SafeAbort("Canvas API must target the actual isolated ephemeral Canvas upstream")
        env["CANVAS_INTERNAL_URL"]=canvas_internal_url
    env.update({
      "DB_HOST":"127.0.0.1","DB_PORT":str(port),"DB_USER":"postgres",
      "DB_PASSWORD":password,"DB_NAME":name,
      "PORT":str(PORT),"NODE_ENV":"test","STARTUP_MODE":"3",
      "PLUGIN_TEST_MODE":"true","PLUGIN_QA_NO_BROWSER":"true",
      "LOG_TO_FILE":"false","LOG_LEVEL":"warn",
      "AUTO_MIGRATE":"true","HTTPS":"true","USE_LOCAL_DATA":"false",
      "VITE_USE_LOCAL_DATA":"false","FRONTEND_URL":"https://localhost:3000",
      "CANVAS_ACCESS_TOKEN":"",
      "CANVAS_CLIENT_SECRET":client_secret or "", "LTI_CLIENT_SECRET":client_secret or "",
      "DEV_TOKEN_SECRET":secrets.token_urlsafe(40),
      "WEBHOOK_SECRET":secrets.token_urlsafe(40),
      "ENCRYPTION_KEY":secrets.token_hex(32),  # EncryptionService requires 64 hex chars.
      "LTI_REDIRECT_URI":"https://localhost:3000/api/lti/callback",
    })
    # Ensure env cannot accidentally target the existing QA database.
    env.pop("DATABASE_URL",None)
    return env

def health():
    ctx=ssl._create_unverified_context()  # Local disposable QA only.
    try:
        with urlopen("https://localhost:3000/health",timeout=3,context=ctx) as response:
            status=response.status
        with urlopen("https://localhost:3000/api/lti/jwks",timeout=3,context=ctx) as response:
            jwks=json.loads(response.read(32768))
            jwks_status=response.status
        return {"healthy":status==200 and jwks_status==200 and bool(jwks.get("keys")),
                "httpsHealthStatus":status,"jwksStatus":jwks_status,"jwksKeyCount":len(jwks.get("keys",[]))}
    except (HTTPError,URLError,TimeoutError,OSError,ValueError):
        return {"healthy":False}

def classify_backend_log_line(raw):
    """Drop all log contents; preserve only a fixed allowlist of error categories."""
    line=raw[:8192].decode("utf-8",errors="replace") if isinstance(raw,bytes) else str(raw)[:8192]
    indicators={
        "type_error":"TypeError",
        "reference_error":"ReferenceError",
        "invalid_url":"ERR_INVALID_URL",
        "database_constraint":"violates foreign key constraint",
        "database_null_constraint":"violates not-null constraint",
        "database_syntax":"invalid input syntax",
        "missing_client_secret":"Falla crítica: CANVAS_CLIENT_SECRET",
        "oauth_token_rejected":"Fallo al intercambiar token",
        "canvas_fetch_failed":"fetch failed",
        "tls_failure":"certificate verify failed",
        "canvas_timeout":"Canvas API timeout",
        "invalid_date":"Invalid time value",
        "missing_property":"Cannot read properties of",
        "oauth_state_failure":"Estado OAuth inválido",
        "unexpected_json":"Unexpected token",
        "runtime_programming_error":"[ERROR-PROG]",
    }
    return {kind for kind,pattern in indicators.items() if pattern.lower() in line.lower()}

def safe_backend_stack_frames(raw):
    """Only repository-relative JS filenames and line numbers, never error text."""
    line=raw[:8192].decode("utf-8",errors="replace") if isinstance(raw,bytes) else str(raw)[:8192]
    found=set()
    for path,number in re.findall(r"apps/server/src/([A-Za-z0-9_./-]+\.(?:js|mjs)):(\d{1,5})",line):
        if ".." not in path and len(path)<120:
            found.add("apps/server/src/"+path+":"+number)
    return found

def scan_backend_logs(stream,categories,frames):
    try:
        for raw in stream:
            categories.update(classify_backend_log_line(raw))
            if len(frames)<16:
                frames.update(safe_backend_stack_frames(raw))
    finally:
        stream.close()

@contextmanager
def backend_lab(*,canvas_url=None,client_id=None,client_secret=None,canvas_internal_url=None):
    guard()
    owner="qa-plugin-lti-"+secrets.token_hex(6)
    dbvolume=owner+"-pg"
    dbcontainer=owner+"-db"
    dbname="qa_lti_"+secrets.token_hex(4)
    password=secrets.token_urlsafe(24)
    cert_before=cert_hashes()
    created=[]
    process=None
    log_thread=None
    log_categories=set()
    log_frames=set()
    yielded=False
    result={"status":"BLOCKED","backendReady":False,"temporaryDb":True,
            "sourceCloneUntouched":False,"cleanupConfirmed":False,
            "reason":None,"mode":"actual_plugin_backend_https"}
    try:
        args=["docker","volume","create",
              "--label","qa.plugin.disposable=true",
              "--label","qa.plugin.owner="+owner,dbvolume]
        volume=run(args)
        if volume.returncode or volume.stdout.strip()!=dbvolume:
            raise SafeAbort("Cannot create owned temporary database volume")
        created.append(("volume",dbvolume))
        port=None
        for _ in range(5):
            candidate_port=free_disposable_host_port()
            args=["docker","run","-d","--name",dbcontainer,
                  "--label","qa.plugin.disposable=true","--label","qa.plugin.owner="+owner,
                  "-e","POSTGRES_USER=postgres",
                  "-e","POSTGRES_PASSWORD="+password,
                  "-e","POSTGRES_DB="+dbname,
                  "-p",f"127.0.0.1:{candidate_port}:5432",
                  "--mount","type=volume,src="+dbvolume+",dst=/var/lib/postgresql/data",
                  "postgres:15-alpine"]
            out=run(args,timeout=40)
            if out.returncode==0:
                created.append(("container",dbcontainer))
                port=port_from_docker(dbcontainer)
                if port!=candidate_port:
                    raise SafeAbort("Unexpected disposable PostgreSQL published port")
                break
            # A failed docker run can still leave a 'created' container.
            # Never clean by name alone: demand exact ephemeral ownership labels.
            existing=run(["docker","container","inspect",dbcontainer],timeout=15)
            if existing.returncode==0:
                labels_ok(dbcontainer,owner)
                removed=run(["docker","rm","-f",dbcontainer],timeout=25)
                if removed.returncode:
                    created.append(("container",dbcontainer))
                    raise SafeAbort("Failed to remove a partially created disposable database")
        if port is None:
            raise SafeAbort("Could not start disposable PostgreSQL 15 after bounded port retries")
        until=time.monotonic()+40
        while time.monotonic()<until:
            p=run(["docker","exec",dbcontainer,"pg_isready","-U","postgres","-d",dbname],timeout=7)
            if p.returncode==0:break
            time.sleep(1)
        else:raise SafeAbort("Disposable PostgreSQL unavailable")
        env=backend_env(port,password,dbname,canvas_url=canvas_url,client_id=client_id,
                        client_secret=client_secret,canvas_internal_url=canvas_internal_url)
        if tcp_bound(PORT):raise SafeAbort("Plugin backend port unexpectedly occupied")
        process=subprocess.Popen(["node","apps/server/src/server.js"],cwd=ROOT,
                                 env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
                                 start_new_session=True)
        log_thread=Thread(target=scan_backend_logs,args=(process.stdout,log_categories,log_frames),
                          daemon=True,name="qa-backend-classification-only")
        log_thread.start()
        result["backendPid"] = process.pid
        limit=time.monotonic()+95
        observed={}
        while time.monotonic()<limit:
            if process.poll() is not None:
                raise SafeAbort("Actual plugin backend exited before health check")
            observed=health()
            if observed.get("healthy"):break
            time.sleep(2)
        if not observed.get("healthy"):
            raise SafeAbort("Plugin backend/JWKS did not become healthy")
        result.update(observed)
        result["status"]="READY"
        result["backendReady"]=True
        result["databaseMigrationMode"]="temporary_only"
        yielded=True
        yield result
    except SafeAbort as exc:
        if yielded:
            raise
        result["reason"]=str(exc)
        yielded=True
        yield result
    finally:
        if process is not None and process.poll() is None:
            try:os.killpg(process.pid,signal.SIGTERM)
            except ProcessLookupError:pass
            try:process.wait(timeout=12)
            except subprocess.TimeoutExpired:
                try:os.killpg(process.pid,signal.SIGKILL)
                except ProcessLookupError:pass
                process.wait(timeout=5)
        if log_thread is not None:
            log_thread.join(timeout=5)
        result["backendLogCategories"]=sorted(log_categories)
        result["backendFailureFrames"]=sorted(log_frames)[:16]
        issues=[]
        for kind,resource in reversed(created):
            try:
                labels_ok(resource,owner,kind)
                args=["docker","rm","-f",resource] if kind=="container" else ["docker","volume","rm",resource]
                deleted=run(args,timeout=25)
                if deleted.returncode:issues.append("temporary_resource_not_removed")
            except SafeAbort:
                issues.append("ownership_mismatch")
        result["cleanupConfirmed"]=not issues
        result["sourceCloneUntouched"]=cert_before==cert_hashes()
        result.pop("backendPid",None)
        if issues or not result["sourceCloneUntouched"]:
            result["status"]="FAIL"
            result["reason"]="Cleanup or original SSL/session key integrity could not be confirmed"

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report",required=True)
    options=parser.parse_args()
    destination=Path(options.report).resolve()
    QA.mkdir(mode=0o700,parents=True,exist_ok=True)
    if not destination.is_relative_to(QA.resolve()):
        raise SafeAbort("Report must be stored under isolated QA directory")
    with backend_lab() as outcome:
        pass
    destination.write_text(json.dumps({
        "generatedAt":datetime.now(timezone.utc).isoformat(),
        "scope":"disposable_plugin_backend_smoke_no_canvas_mutation",
        "result":outcome},ensure_ascii=False,indent=2)+"\n")
    destination.chmod(0o600)
    print("QA_PLUGIN_BACKEND","STATUS",outcome["status"],
          "HEALTHY",outcome["backendReady"],"CLEANED",outcome["cleanupConfirmed"],
          "UNCHANGED",outcome["sourceCloneUntouched"])
    print("QA_PLUGIN_BACKEND_REPORT",destination)
    return 0 if outcome["status"]=="READY" and outcome["cleanupConfirmed"] and outcome["sourceCloneUntouched"] else 2

if __name__=="__main__":
    try:sys.exit(main())
    except (SafeAbort,OSError,ValueError) as exc:
        print("QA_PLUGIN_BACKEND_BLOCKED",type(exc).__name__,file=sys.stderr)
        sys.exit(3)
