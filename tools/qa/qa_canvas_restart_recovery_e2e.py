#!/usr/bin/env python3
"""Real QA Canvas web interruption/restart + headless login on a copied database.

This intentionally proves *service restart*, not recovery of an unfinished
full Rails installation. No historical repositories or PostgreSQL volumes edited.
"""
import argparse
from datetime import datetime,timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.request import urlopen
from urllib.error import URLError,HTTPError

from historical_full_stack import pair_experiment, QABlocked
from isolated_plugin_backend import HOME, ROOT, QA, read_qa_env

def guard():
    for name in ("QA_ALLOW_CANVAS_RESTART_E2E","QA_ALLOW_HISTORICAL_FULL_STACK",
                 "PLUGIN_TEST_MODE","PLUGIN_QA_NO_BROWSER"):
        if os.environ.get(name)!="true":raise QABlocked("Explicit restart-only QA authorization required")

def docker(command,stdin=None,timeout=30):
    try:
        return subprocess.run(command,input=stdin,capture_output=True,text=True,
                              check=False,timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise QABlocked("Bounded disposable Docker command timed out") from exc

def owned_web(name):
    if not re.fullmatch(r"qa-hpair-[a-f0-9]{12}-web",name):
        raise QABlocked("Canvas web container is not a disposable QA pair")
    command=docker(["docker","inspect",name,"--format","{{json .}}"])
    if command.returncode:raise QABlocked("QA web container unavailable")
    details=json.loads(command.stdout)
    labels=(details.get("Config",{}) or {}).get("Labels") or {}
    if labels.get("qa.canvas.pair.disposable")!="true" or (
        labels.get("qa.canvas.pair.owner")!=name.removesuffix("-web")
    ):
        raise QABlocked("QA web owner label mismatch")
    return True

def current_disposable_web_url(name):
    # Docker may reallocate a dynamic host port after a container restart.
    owned_web(name)
    published=docker(["docker","port",name,"80/tcp"],timeout=12)
    if published.returncode:
        raise QABlocked("Disposable Canvas port is unavailable")
    match=re.fullmatch(r"127\.0\.0\.1:([1-9][0-9]{3,4})",published.stdout.strip())
    if not match or int(match.group(1))>65535:
        raise QABlocked("Canvas restart has no unique localhost-only published port")
    return f"http://127.0.0.1:{match.group(1)}"

def signature(postgres):
    if not re.fullmatch(r"qa-hpair-[a-f0-9]{12}-db",postgres):
        raise QABlocked("Cannot inspect non-ephemeral PostgreSQL")
    sql="""BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
  'accounts', (SELECT md5(COALESCE(string_agg(id::text, ',' ORDER BY id),''))
               FROM accounts),
  'terms', (SELECT md5(COALESCE(string_agg(id::text||':'||account_id::text, ',' ORDER BY id),''))
            FROM terms_of_services),
  'shards', (SELECT md5(COALESCE(string_agg(id::text, ',' ORDER BY id),''))
             FROM switchman_shards),
  'migrations', (SELECT md5(COALESCE(string_agg(version::text, ',' ORDER BY version),''))
                 FROM schema_migrations),
  'orphanTerms', (SELECT count(*) FROM terms_of_services t
                   LEFT JOIN accounts a ON a.id=t.account_id WHERE a.id IS NULL)
);
ROLLBACK;
"""
    result=docker(["docker","exec","-i","-e","PGOPTIONS=-c default_transaction_read_only=on",
       postgres,"psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1",
       "-U","postgres","-d","canvas_development"],stdin=sql,timeout=35)
    if result.returncode:raise QABlocked("Read-only Canvas integrity query failed")
    try:
        payload=json.loads(result.stdout.strip().splitlines()[-1])
    except (ValueError,IndexError) as exc:
        raise QABlocked("Unexpected Canvas integrity response") from exc
    keys=("accounts","terms","shards","migrations")
    if any(not re.fullmatch(r"[a-f0-9]{32}",str(payload.get(k,""))) for k in keys):
        raise QABlocked("Unexpected Canvas integrity fingerprint")
    if not isinstance(payload.get("orphanTerms"),int):
        raise QABlocked("Unexpected term reference verification")
    return payload

def wait_web(url,container):
    # A restarted Rails process may require a longer cold boot than an HTTP reconnect.
    end=time.monotonic()+140
    last_http=None
    last_failure="none"
    while time.monotonic()<end:
        state=docker(["docker","inspect",container,"--format","{{.State.Running}}"],timeout=10)
        if state.returncode or state.stdout.strip()!="true":
            raise QABlocked("Disposable Canvas web failed to restart")
        try:
            with urlopen(url+"/login/canvas",timeout=4) as resp:
                last_http=resp.status
                if resp.status==200:return True
        except HTTPError as exc:
            last_http=exc.code
            last_failure="http"
        except (URLError,TimeoutError,OSError) as exc:
            last_failure=type(exc).__name__
        time.sleep(2)
    # Only bounded diagnostic classes and numeric HTTP statuses; no Rails logs or cookies.
    raise QABlocked(f"Canvas login not restored (http={last_http}, failure={last_failure})")

def recheck_login(url):
    qa=read_qa_env()
    password=qa.get("CANVAS_ADMIN_PASS")
    if not password:raise QABlocked("Synthetic QA admin password unavailable")
    script=ROOT/"tools/diagnostics/qa_canvas_sessions_headless.mjs"
    env={key:os.environ[key] for key in ("PATH","HOME","USER","LANG","TERM") if key in os.environ}
    env.update({
       "QA_CANVAS_URL":url,"QA_LOGIN_USER":"admin@canvas.local",
       "QA_LOGIN_PASSWORD":password,"QA_SCENARIO":"reload",
       "QA_INJECT_FK":"0","PLUGIN_QA_NO_BROWSER":"true",
       "QA_EVIDENCE_PREFIX":"isolated-web-restart-check",
       "QA_SCREENSHOT_DIR":str(QA/"qa-restart-headless"),
    })
    try:
        proc=subprocess.run(["node",str(script)],cwd=ROOT,env=env,
            capture_output=True,text=True,timeout=135,check=False)
    except subprocess.TimeoutExpired:
        return {"status":"TIMEOUT","checks":0}
    entries=[]
    for line in proc.stdout.splitlines():
        if line.startswith("QA_SESSION_CHECKS "):
            try:entries.append(json.loads(line.partition("QA_SESSION_CHECKS ")[2]))
            except ValueError:pass
    checks=(entries[-1].get("checks") or {}) if entries else {}
    passed=proc.returncode==0 and len(checks)>=7 and all(v is True for v in checks.values())
    return {"status":"PASS" if passed else "FAIL","checks":len(checks),
            "passed":sum(value is True for value in checks.values())}

def restart_qa_web(context):
    web=context["container"];db=context["postgres"];url=context["canvasUrl"]
    result={"scope":"disposable_canvas_only",
            "fullInstallerRecoveryProven":False,
            "restartScenario":"single_web_service_interruption"}
    try:
        initial_url=current_disposable_web_url(web)
        if initial_url!=url:
            raise QABlocked("Canvas QA URL differs from its verified published port")
        initial=signature(db)
        restart=docker(["docker","restart","--timeout","8",web],timeout=45)
        if restart.returncode or restart.stdout.strip()!=web:
            raise QABlocked("Could not restart disposable Canvas web")
        restored_url=current_disposable_web_url(web)
        result["hostPortReassigned"]=restored_url!=initial_url
        result["webRecovered"]=wait_web(restored_url,web)
        subsequent=signature(db)
        result["integrityPreserved"]=initial==subsequent
        result["orphanTerms"]=subsequent["orphanTerms"]
        result["headless"]=recheck_login(restored_url)
        result["status"]="PASS" if (
            result["webRecovered"] and result["integrityPreserved"] and
            subsequent["orphanTerms"]==0 and result["headless"]["status"]=="PASS"
        ) else "FAIL"
    except QABlocked as exc:
        result["status"]="BLOCKED"
        result["reason"]=str(exc)
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report",required=True)
    parser.add_argument("--pair",choices=("august","october"),default="october")
    options=parser.parse_args()
    guard()
    output=Path(options.report).resolve()
    if not output.is_relative_to(QA.resolve()):
        raise QABlocked("Report outside authorized QA folder")
    result=pair_experiment(options.pair,role="admin",lti_hook=restart_qa_web)
    test=result.get("isolatedLti") or {}
    complete=(result.get("cleanupConfirmed") is True and
              result.get("status")=="PASS_HTTP" and
              result.get("headlessStatus")=="PASS" and test.get("status")=="PASS")
    report={"timestamp":datetime.now(timezone.utc).isoformat(),
      "mode":"disposable_canvas_web_recovery_e2e",
      "fullInstallerRecoveryProven":False,"serviceRestartE2EConfirmed":complete,
      "originalCanvasModified":False,"result":result}
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    output.chmod(0o600)
    print("QA_WEB_RESTART_E2E","PASS",complete,"RESTART",test.get("status"),
          "CLEAN",result.get("cleanupConfirmed"),
          "NORMAL_LOGIN",result.get("headlessStatus"))
    return 0 if complete else 2

if __name__=="__main__":
    try:sys.exit(main())
    except (QABlocked,OSError,ValueError) as exc:
        print("QA_WEB_RESTART_BLOCKED",type(exc).__name__,file=sys.stderr)
        sys.exit(3)
