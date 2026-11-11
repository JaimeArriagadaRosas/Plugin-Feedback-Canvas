#!/usr/bin/env python3
"""Cross-version Canvas smoke + headless login against disposable PostgreSQL copies.

NEVER write, migrate, start, or stop historical containers/volumes/repositories.
Every Docker operation has an explicit random QA owner label, private network, and
bounded lifetime. All application sources/gems from historical projects mount RO.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time
from datetime import datetime, timezone
from urllib import request, error
from http.client import HTTPException

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
QA = Path.home() / "qa-feedback-20261110" / "artifacts"
ALLOWED = {
    "august": {
        "db": "august-canvas-db",
        "web": "canvas-lms-main-video-clean-web-1",
        "source": Path.home() / "proyectos/canvas-lms-main-video-clean",
        "project": "canvas-lms-main-video-clean"
    },
    "october": {
        "db": "october-canvas-db",
        "web": "canvas-lms-master-web-1",
        "source": Path.home() / "proyectos/canvas-lms-master",
        "project": "canvas-lms-master"
    },
    "august-web-october-data": {
        "db": "october-canvas-db",
        "web": "canvas-lms-main-video-clean-web-1",
        "source": Path.home() / "proyectos/canvas-lms-main-video-clean",
        "project": "canvas-lms-main-video-clean"
    },
    "october-web-august-data": {
        "db": "august-canvas-db",
        "web": "canvas-lms-master-web-1",
        "source": Path.home() / "proyectos/canvas-lms-master",
        "project": "canvas-lms-master"
    },
    "october-incomplete": {
        "db": "october-alternate-db",
        "web": "canvas-lms-master-web-1",
        "source": Path.home() / "proyectos/canvas-lms-master",
        "project": "canvas-lms-master"
    },
    "august-web-october-data-matched-key": {
        "db": "october-canvas-db",
        "web": "canvas-lms-main-video-clean-web-1",
        "source": Path.home() / "proyectos/canvas-lms-main-video-clean",
        "project": "canvas-lms-main-video-clean",
        "keyFrom": "october"
    },
    "october-web-august-data-matched-key": {
        "db": "august-canvas-db",
        "web": "canvas-lms-master-web-1",
        "source": Path.home() / "proyectos/canvas-lms-master",
        "project": "canvas-lms-master",
        "keyFrom": "august"
    }
}
sys.path.insert(0, str(HERE))
from historical_compatibility_lab import inspected_pg, pg_major, matching_image, command, QABlocked

def safe_run(args, timeout=45, **kwargs):
    return command(args, timeout=timeout, **kwargs)

def env_guard():
    for flag in ("QA_ALLOW_HISTORICAL_FULL_STACK", "PLUGIN_TEST_MODE", "PLUGIN_QA_NO_BROWSER"):
        if os.getenv(flag) != "true":raise QABlocked("Explicit historical QA + no-browser flags required")
    if ROOT != (Path.home()/"proyectos/Plugin-Feedback-Canvas-feedback-cualitativo").resolve():
        raise QABlocked("Only unified clone is authorized")
    QA.mkdir(parents=True, exist_ok=True)
    if QA.is_symlink() or not QA.resolve().is_relative_to(Path.home()/"qa-feedback-20261110"):
        raise QABlocked("QA artifact path invalid")

def docker_obj(name,kind="container"):
    p=safe_run(["docker",kind,"inspect",name,"--format","{{json .}}"],timeout=15)
    if p.returncode:raise QABlocked("QA Docker resource not found")
    return json.loads(p.stdout)

def verified_web(pair):
    label=ALLOWED[pair]
    obj=docker_obj(label["web"])
    labels=obj["Config"].get("Labels") or {}
    if (labels.get("com.docker.compose.project") != label["project"] or
        labels.get("com.docker.compose.service") != "web" or
        Path(labels.get("com.docker.compose.project.working_dir") or "/").resolve() != label["source"].resolve() or
        obj["State"]["Running"]):
        raise QABlocked("Historic Rails container identity mismatch or currently running")
    binds={m["Destination"]:m for m in obj["Mounts"]}
    if binds.get("/usr/src/app",{}).get("Type") != "bind" or Path(binds["/usr/src/app"]["Source"]).resolve()!=label["source"].resolve():
        raise QABlocked("Historic Rails app source mount cannot be verified")
    gems=[]
    for dst in ("/home/docker/.bundle","/home/docker/.gem"):
        x=binds.get(dst,{})
        if x.get("Type")!="volume" or not x.get("Name"):
            raise QABlocked("Historical gem cache volume missing")
        gems.append((dst,x["Name"]))
    env={}
    for item in obj["Config"].get("Env") or []:
        key,sep,value=item.partition("=")
        if sep and key in {"POSTGRES_PASSWORD","ENCRYPTION_KEY","RAILS_ENV",
                          "CANVAS_RAILS","CANVAS_LTI_COURSE_NAVIGATION","RSPACK"}:
            env[key]=value
    if len(env.get("POSTGRES_PASSWORD",""))<1 or len(env.get("ENCRYPTION_KEY",""))<20:
        raise QABlocked("Historic Rails environment lacks encryption/database settings")
    return {"image":obj["Config"]["Image"],"env":env,"gems":gems}

def checked_owner(name,owner,kind="container"):
    obj=docker_obj(name,"volume" if kind=="volume" else "container")
    labels=(obj.get("Labels") if kind=="volume" else obj.get("Config",{}).get("Labels")) or {}
    if labels.get("qa.canvas.pair.owner")!=owner or labels.get("qa.canvas.pair.disposable")!="true":
        raise QABlocked("Disposable resource owner label mismatch")

def schema_read_only(container):
    sql = """BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
 'accounts',to_regclass('public.accounts') IS NOT NULL,
 'terms',to_regclass('public.terms_of_services') IS NOT NULL,
 'shards',to_regclass('public.switchman_shards') IS NOT NULL,
 'migrations',to_regclass('public.schema_migrations') IS NOT NULL,
 'ltiTools',to_regclass('public.context_external_tools') IS NOT NULL
);
ROLLBACK;
"""
    response=safe_run(["docker","exec","-i","-e",
                      "PGOPTIONS=-c default_transaction_read_only=on",
                      container,"psql","-X","-q","-A","-t",
                      "-v","ON_ERROR_STOP=1","-U","postgres",
                      "-d","canvas_development"],stdin=sql.encode(),timeout=35)
    if response.returncode:raise QABlocked("Historical Canvas schema cannot be read safely")
    lines=[line.strip() for line in response.stdout.decode(errors="replace").splitlines() if line.strip()]
    if not lines:raise QABlocked("Empty historical Canvas catalog response")
    try:catalog=json.loads(lines[-1])
    except json.JSONDecodeError as exc:raise QABlocked("Unknown Canvas catalog result") from exc
    return catalog

def exception_fingerprint(text):
    # Never match the *name* of a successful browser assertion such as
    # login_no_fk; require real Rails/PostgreSQL exception signatures.
    observed=("ActiveRecord::InvalidForeignKey" in text or
              "PG::ForeignKeyViolation" in text) and "terms_of_services" in text
    return {"fkObserved":observed,
            "fkSignatureMatch":observed and "fk_rails_337ba633a9" in text,
            "loginControllerMatch":observed and "Login::CanvasController#create" in text}

def pair_experiment(pair, role="admin", *, lti_hook=None):
    if pair not in ALLOWED:raise QABlocked("Historical pair not allowlisted")
    if role not in ("admin","professor","student"):
        raise QABlocked("Historical QA login role not authorized")
    web=verified_web(pair)
    original=inspected_pg(ALLOWED[pair]["db"])
    major=pg_major(original)
    db_image=matching_image(original,major)
    owner="qa-hpair-"+secrets.token_hex(6)
    network=owner+"-net"
    dbvol=owner+"-pg"
    dbname=owner+"-db"
    redisname=owner+"-redis"
    webname=owner+"-web"
    logfile=owner+"-log"
    tmpfile=owner+"-tmp"
    resources=[]
    results={"pair":pair,"role":role,"sourceWebImage":web["image"],"pgMajor":major,
             "sourceMountMode":"readonly","originalResourcesModified":False,
             "network":"private_bridge_localhost_only","databaseVolume":"copy_only",
             "status":"BLOCKED","headlessStatus":"NOT_RUN",
             "httpStatus":None,"fkObserved":False,"cleanupConfirmed":False}
    secrets_dir=QA/"historical-pair-secrets"
    secrets_dir.mkdir(mode=0o700,exist_ok=True)
    envfile=secrets_dir/(owner+".env")
    try:
        def make_volume(name):
            p=safe_run(["docker","volume","create",
                        "--label","qa.canvas.pair.disposable=true",
                        "--label","qa.canvas.pair.owner="+owner,name],timeout=20)
            if p.returncode or p.stdout.decode().strip()!=name:
                raise QABlocked("Cannot create owned QA volume")
            resources.append(("volume",name))
        def run_container(name,args):
            p=safe_run(["docker","run","-d","--name",name,
                        "--label","qa.canvas.pair.disposable=true",
                        "--label","qa.canvas.pair.owner="+owner,*args],timeout=40)
            if p.returncode:raise QABlocked("Cannot start isolated QA service "+name.split("-")[-1])
            resources.append(("container",name))

        created=safe_run(["docker","network","create",
                          "--label","qa.canvas.pair.disposable=true",
                          "--label","qa.canvas.pair.owner="+owner,network],timeout=20)
        if created.returncode:raise QABlocked("Cannot create private QA network")
        resources.append(("network",network))
        for vol in (dbvol,logfile,tmpfile):make_volume(vol)
        # Source DB is mounted by Docker in enforced read-only mode; only the
        # newly labelled QA volume can receive modifications.
        clone=safe_run(["docker","run","--rm","--network","none",
            "--mount",f"type=volume,src={original['volume']},dst=/source,readonly",
            "--mount",f"type=volume,src={dbvol},dst=/copy",
            "--entrypoint","sh",db_image,"-ec",
            f"cp -a /source/. /copy/; test \"$(cat /copy/PG_VERSION)\" = '{major}'"],timeout=180)
        if clone.returncode:raise QABlocked("Read-only source volume copy failed")
        run_container(dbname,[
            "--network",network,"--network-alias","postgres",
            "--mount",f"type=volume,src={dbvol},dst=/var/lib/postgresql/data",
            "--tmpfs","/tmp:rw,mode=1777",
            "--user","postgres","--entrypoint","postgres",db_image,
            "-D","/var/lib/postgresql/data","-c","listen_addresses=*"])
        # Do not start Rails against a database without the minimal Canvas schema.
        # The exact same historical volume remains read-only and the copied volume
        # is the ONLY inspected database.
        deadline=time.monotonic()+45
        while time.monotonic()<deadline:
            ready=safe_run(["docker","exec",dbname,"pg_isready","-U","postgres",
                            "-d","canvas_development"],timeout=8)
            if ready.returncode==0:break
            time.sleep(1)
        else:raise QABlocked("Cloned historical PostgreSQL never became available")
        catalog=schema_read_only(dbname)
        results["schemaCatalog"]=catalog
        if not all(catalog.get(key) is True for key in ("accounts","terms","shards","migrations")):
            results["status"]="SAFELY_BLOCKED"
            results["reason"]="Historical Canvas core schema is incomplete; Rails was not started"
            results["headlessStatus"]="NOT_RUN_SCHEMA_BLOCKED"
            return results

        run_container(redisname,[
            "--network",network,"--network-alias","redis",
            "--read-only","--tmpfs","/data:rw,mode=1777",
            "redis:alpine","redis-server","--save","","--appendonly","no"])

        web_env={**web["env"],"RAILS_ENV":"development"}
        matching_key_source=ALLOWED[pair].get("keyFrom")
        if matching_key_source:
            # The encryption key is read only from the verified historical owner
            # of the copied data, used solely inside this disposable QA process,
            # never printed or saved in Git.
            source_key=verified_web(matching_key_source)["env"]["ENCRYPTION_KEY"]
            if source_key == web_env["ENCRYPTION_KEY"]:
                raise QABlocked("Encryption mismatch control is not meaningful: keys already match")
            web_env["ENCRYPTION_KEY"]=source_key
            results["keyCompatibility"]="matched_to_copied_database_owner"
        else:
            results["keyCompatibility"]="original_historical_web_env"
        envfile.write_text("".join(k+"="+v+"\n" for k,v in web_env.items()))
        envfile.chmod(0o600)
        gems_args=[]
        for target,source in web["gems"]:
            gems_args += ["--mount",f"type=volume,src={source},dst={target},readonly"]
        run_container(webname,[
            "--network",network,"--network-alias","web",
            "--add-host","host.docker.internal:host-gateway",
            "-p","127.0.0.1::80",
            "--env-file",str(envfile),
            "--mount",f"type=bind,src={ALLOWED[pair]['source']},dst=/usr/src/app,readonly",
            "--mount",f"type=volume,src={logfile},dst=/usr/src/app/log",
            "--mount",f"type=volume,src={tmpfile},dst=/usr/src/app/tmp",
            *gems_args,web["image"]])
        host_port=safe_run(["docker","port",webname,"80/tcp"],timeout=12)
        ports=re.findall(rb"127\.0\.0\.1:(\d+)",host_port.stdout)
        if host_port.returncode or len(ports)!=1:
            raise QABlocked("Web listener does not have a single localhost-only port")
        port=int(ports[0])
        base=f"http://127.0.0.1:{port}"
        deadline=time.monotonic()+115
        while time.monotonic()<deadline:
            state=docker_obj(webname)["State"]
            if not state["Running"]:
                raise QABlocked("Rails web container exited during startup")
            try:
                with request.urlopen(base+"/login/canvas",timeout=3) as response:
                    results["httpStatus"]=response.status
                    if response.status <500: break
            except error.HTTPError as exc:
                results["httpStatus"]=exc.code
                if exc.code <500:break
            except (error.URLError, TimeoutError, ConnectionError, HTTPException, OSError):
                pass
            time.sleep(3)
        if results["httpStatus"] is None or results["httpStatus"]>=500:
            raise QABlocked("Historical Rails web did not become available with working login page")
        results["status"]="PASS_HTTP"
        results["browserUrlPortVerified"]=True
        # Use only explicitly synthetic Canvas QA test accounts. Do not
        # report credentials or raw Rails output. No artificial FK exception.
        fixture=Path.home()/"qa-feedback-20261110/clean/Plugin-Feedback-Canvas/.env"
        role_settings={
            "admin":("admin@canvas.local","CANVAS_ADMIN_PASS","reload"),
            "professor":("profesor@canvas.local","CANVAS_TEACHER_PASS","tampered_cookie"),
            "student":("estudiante1@canvas.local","CANVAS_STUDENT_PASS","login_only")
        }
        login_user,secret_field,scenario=role_settings[role]
        login_pass=None
        if fixture.is_file():
            for line in fixture.read_text().splitlines():
                if line.startswith(secret_field+"="):
                    login_pass=line.split("=",1)[1].strip().strip("'\"")
                    break
        if not login_pass:
            results["headlessStatus"]="SKIPPED_SYNTHETIC_CREDENTIALS_UNAVAILABLE"
        else:
            scripts=ROOT/"tools/diagnostics/qa_canvas_sessions_headless.mjs"
            outdir=QA/"historical-pair-headless"
            outdir.mkdir(parents=True,exist_ok=True,mode=0o700)
            env={**os.environ,
                 "QA_CANVAS_URL":base,
                 "QA_LOGIN_USER":login_user,
                 "QA_LOGIN_PASSWORD":login_pass,
                 "QA_SCENARIO":scenario,
                 "QA_INJECT_FK":"0",
                 "QA_EVIDENCE_PREFIX":owner+"-"+role+"-login",
                 "QA_SCREENSHOT_DIR":str(outdir),
                 "PLUGIN_QA_NO_BROWSER":"true"}
            browser=safe_run(["node",str(scripts)],timeout=160,cwd=ROOT,env=env)
            valid=[]
            for line in browser.stdout.decode(errors="replace").splitlines():
                if line.startswith("QA_SESSION_CHECKS "):
                    try:valid.append(json.loads(line.removeprefix("QA_SESSION_CHECKS ")))
                    except json.JSONDecodeError:pass
            checks=(valid[-1].get("checks") or {}) if valid else {}
            results["browserChecks"]=len(checks)
            results["browserPassCount"]=sum(x is True for x in checks.values())
            results["headlessStatus"]="PASS" if browser.returncode==0 and checks and all(v is True for v in checks.values()) else "FAIL"
            # Never mistake the successful check name 'login_no_fk' for an FK error.
            # Look only for real exception signatures in this disposable web instance.
            web_logs=safe_run(["docker","logs","--tail","200",webname],timeout=20)
            rails_logs=safe_run(["docker","exec",webname,"tail","-n","250",
                                "/usr/src/app/log/development.log"],timeout=20)
            combined=(web_logs.stdout+web_logs.stderr+rails_logs.stdout+rails_logs.stderr).decode(errors="replace")
            results.update(exception_fingerprint(combined))
        if lti_hook is not None:
            if not callable(lti_hook):
                raise QABlocked("QA LTI hook is not callable")
            results["isolatedLti"]=lti_hook({
                "container":webname,"postgres":dbname,"canvasUrl":base,
                "pair":pair,"role":role,
            })

        return results
    except (QABlocked, OSError, TimeoutError, HTTPException) as exc:
        results["status"]="BLOCKED"
        results["reason"]=str(exc) if isinstance(exc, QABlocked) else type(exc).__name__
        if ("container",webname) in resources:
            raw=safe_run(["docker","logs","--tail","80",webname],timeout=15)
            output=(raw.stdout+raw.stderr).decode(errors="replace").lower()
            rails_log=safe_run(["docker","exec",webname,"tail","-n","200",
                                "/usr/src/app/log/development.log"],timeout=20)
            results.update(exception_fingerprint(
                (raw.stdout+raw.stderr+rails_log.stdout+rails_log.stderr).decode(errors="replace")))
            results["failureIndicators"]=[
                clue for clue in ("permission denied","read-only file system",
                                  "bundler","missing gem","nginx","postgres",
                                  "redis","migration","database","connection refused",
                                  "already in use")
                if clue in output]
        return results
    finally:
        envfile.unlink(missing_ok=True)
        issues=[]
        for kind,name in reversed(resources):
            try:
                if kind=="network":
                    obj=docker_obj(name,"network")
                    labels=obj.get("Labels") or {}
                    if labels.get("qa.canvas.pair.owner")!=owner:
                        raise QABlocked("network ownership mismatch")
                    cmd=["docker","network","rm",name]
                else:
                    checked_owner(name,owner,kind)
                    cmd=["docker","rm","-f",name] if kind=="container" else ["docker","volume","rm",name]
                result=safe_run(cmd,timeout=50)
                if result.returncode:issues.append(kind+"_not_removed")
            except QABlocked:
                issues.append(kind+"_owner_mismatch")
        results["cleanupConfirmed"]=len(issues)==0
        if issues:
            results["status"]="FAIL"
            results["cleanupIssues"]=issues

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pair",required=True,choices=tuple(ALLOWED))
    parser.add_argument("--report",required=True)
    parser.add_argument("--role",choices=("admin","professor","student"),default="admin")
    args=parser.parse_args()
    env_guard()
    path=Path(args.report).resolve()
    if not path.is_relative_to(QA.resolve()):raise QABlocked("Report path outside isolated QA")
    results=pair_experiment(args.pair,args.role)
    report={"timestamp":datetime.now(timezone.utc).isoformat(),"execution":"ephemeral_full_stack",
            "normalMenusEdited":False,"historicalRepositoriesModified":False,
            "historicalDatabaseVolumesModified":False,"ltiCrossVersionVerified":False,
            "result":results}
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    path.chmod(0o600)
    print("QA_HISTORICAL_PAIR",args.pair,args.role,results["status"],
          "HTTP",results.get("httpStatus"),
          "HEADLESS",results.get("headlessStatus"),
          "CLEAN",results.get("cleanupConfirmed"))
    print("QA_HISTORICAL_PAIR_REPORT",path)
    return 0 if results["status"]=="PASS_HTTP" and results["headlessStatus"]=="PASS" and results["cleanupConfirmed"] else 2

if __name__=="__main__":
    try:sys.exit(main())
    except (QABlocked,OSError,ValueError) as exc:
        print("QA_HISTORICAL_PAIR_BLOCKED",type(exc).__name__,file=sys.stderr)
        sys.exit(3)
