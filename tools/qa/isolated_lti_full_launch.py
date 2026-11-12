#!/usr/bin/env python3
"""Full Canvas-to-actual-Plugin LTI experiment on disposable Canvas + plugin databases.

The result is only PASS when real headless browser launches render the plugin UI.
No historical containers, their volumes, or the normal interactive menu are edited.
"""
from datetime import datetime, timezone
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys

from historical_full_stack import pair_experiment, QABlocked
from isolated_plugin_backend import backend_lab, SafeAbort, read_qa_env, ROOT, QA
from qa_canvas_https_proxy import qa_canvas_https, ProxyBlocked

HEADLESS = ROOT/"tools/qa/qa_canvas_plugin_lti_headless.mjs"

def explicit_authorization():
    for key in ("QA_ALLOW_FULL_LTI_E2E", "QA_ALLOW_HISTORICAL_FULL_STACK",
                "QA_ALLOW_ISOLATED_PLUGIN_BACKEND","PLUGIN_TEST_MODE","PLUGIN_QA_NO_BROWSER"):
        if os.environ.get(key)!="true":
            raise SafeAbort("Explicit disposable LTI QA and no-browser flags required")

def lti_client_from_copied_canvas(postgres):
    if not re.fullmatch(r"qa-hpair-[a-z0-9]+-db",postgres):
        raise SafeAbort("Refusing to inspect database outside an ephemeral Canvas pair")
    sql="""BEGIN TRANSACTION READ ONLY;
SELECT developer_key_id FROM public.context_external_tools
WHERE name='Feedback' AND workflow_state='public'
  AND url LIKE 'https://localhost:3000%'
  AND developer_key_id IS NOT NULL;
ROLLBACK;
"""
    try:
        result=subprocess.run([
          "docker","exec","-i","-e","PGOPTIONS=-c default_transaction_read_only=on",
          postgres,"psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1",
          "-U","postgres","-d","canvas_development"],
          input=sql,text=True,capture_output=True,timeout=25,check=False)
    except subprocess.TimeoutExpired as exc:
        raise SafeAbort("Canvas tool metadata query timed out") from exc
    ids=[value.strip() for value in result.stdout.splitlines() if value.strip()]
    if result.returncode!=0 or len(ids)!=1 or not re.fullmatch(r"[1-9][0-9]{0,17}",ids[0]):
        raise SafeAbort("Exactly one active Canvas Feedback client required in disposable copy")
    return ids[0]

def lti_secret_from_copied_canvas(postgres, client_id):
    """Read the disposable Canvas developer key into memory; never log or persist it."""
    if not re.fullmatch(r"qa-hpair-[a-z0-9]+-db", postgres):
        raise SafeAbort("Refusing OAuth credential lookup outside disposable Canvas")
    if not re.fullmatch(r"[1-9][0-9]{0,17}", client_id):
        raise SafeAbort("Invalid disposable OAuth client id")
    sql=f"""BEGIN TRANSACTION READ ONLY;
SELECT encode(convert_to(api_key,'UTF8'),'hex') FROM public.developer_keys
WHERE id={client_id} AND workflow_state='active'
  AND is_lti_key IS TRUE AND api_key IS NOT NULL AND length(api_key)>=12;
ROLLBACK;
"""
    try:
        response=subprocess.run([
            "docker","exec","-i","-e","PGOPTIONS=-c default_transaction_read_only=on",
            postgres,"psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1",
            "-U","postgres","-d","canvas_development"],
            input=sql,text=True,capture_output=True,timeout=25,check=False)
    except subprocess.TimeoutExpired as exc:
        raise SafeAbort("Disposable Canvas OAuth metadata lookup timed out") from exc
    rows=[v.strip() for v in response.stdout.splitlines() if v.strip()]
    if response.returncode or len(rows)!=1 or not re.fullmatch(r"(?:[0-9a-f]{2}){12,}",rows[0]):
        raise SafeAbort("Exactly one active disposable Canvas OAuth client secret required")
    secret=bytes.fromhex(rows[0]).decode('utf-8')
    if len(secret)<12 or "\n" in secret or "\r" in secret:
        raise SafeAbort("Disposable Canvas OAuth credential malformed")
    return secret

def browser_check(canvas_url,user,secret):
    environment={key:os.environ[key] for key in ("PATH","HOME","USER","LANG","TERM")
                 if key in os.environ}
    environment.update({
        "QA_ALLOW_FULL_LTI_E2E":"true","PLUGIN_TEST_MODE":"true",
        "PLUGIN_QA_NO_BROWSER":"true","QA_CANVAS_URL":canvas_url,
        "QA_LOGIN_USER":user,"QA_LOGIN_PASSWORD":secret,
    })
    try:
        run=subprocess.run(["node",str(HEADLESS)],cwd=ROOT,
            env=environment,capture_output=True,text=True,timeout=135,check=False)
    except subprocess.TimeoutExpired:
        return {"status":"TIMEOUT","browserPassed":False}
    lines=[line.partition("QA_LTI_E2E_RESULT=")[2] for line in run.stdout.splitlines()
           if line.startswith("QA_LTI_E2E_RESULT=")]
    try:result=json.loads(lines[-1]) if lines else None
    except ValueError:result=None
    if not isinstance(result,dict):
        return {"status":"FAILED_NO_REPORT","browserPassed":False}
    if run.returncode==0 and result.get("passed") is True and not result.get("fkExceptionFound"):
        result["status"]="PASS"
    else:
        result["status"]="FAIL"
    # Never retain or print credentials, JWTs, URL query strings, browser storage or screenshots.
    return result

def role_cases_confirmed(cases, selected_roles):
    if selected_roles not in ("admin", "both"):
        raise SafeAbort("Unexpected QA role selection")
    expected=("admin",) if selected_roles=="admin" else ("admin","professor")
    return len(cases)==len(expected) and all(
        item.get("role")==role and
        item.get("status")=="PASS" and
        item.get("pluginUiVisible") is True and
        item.get("feedbackTabVisible") is True and
        item.get("oauthCallbackSucceeded") is True and
        item.get("courseApiSucceeded") is True and
        200 in (item.get("coursesHttpAfterOauthStatuses") or [])
        for item,role in zip(cases,expected)
    )

def launch_in_disposable_canvas(context):
    record={"status":"BLOCKED","actualLtiLaunchConfirmed":False,
            "canvasWriteScope":"disposable_canvas_only",
            "pluginDatabaseScope":"fresh_disposable_postgres",
            "registrationMode":"existing_historical_tool_no_mutation",
            "backendCleanupConfirmed":False}
    try:
        client=lti_client_from_copied_canvas(context["postgres"])
        credential=lti_secret_from_copied_canvas(context["postgres"],client)
        record["historicClientIdentified"]=True
        record["oauthClientCredentialAvailable"]=True
        with qa_canvas_https(context["canvasUrl"]) as canvas_canonical:
            with backend_lab(canvas_url=canvas_canonical,client_id=client,
                             client_secret=credential,
                             canvas_internal_url=context["canvasUrl"]) as backend:
                record["backendHttpsJwksReady"]=bool(backend.get("backendReady"))
                if backend.get("status")!="READY":
                    record["reason"]=backend.get("reason","Backend failed readiness")
                else:
                    qa=read_qa_env()
                    cases=[]
                    allowed_roles=os.environ.get("QA_LTI_SELECTED_ROLES","both")
                    role_cases=(
                        ("admin","admin@canvas.local","CANVAS_ADMIN_PASS"),
                        ("professor","profesor@canvas.local","CANVAS_TEACHER_PASS"),
                    )
                    for role,username,secret_name in role_cases:
                        if allowed_roles=="admin" and role!="admin":
                            continue
                        secret=qa.get(secret_name)
                        if not secret:
                            cases.append({"role":role,"status":"SKIPPED_NO_SYNTHETIC_PASSWORD"})
                            continue
                        result=browser_check(canvas_canonical,username,secret)
                        result["role"]=role
                        cases.append(result)
                    record["roles"]=cases
                    record["actualLtiLaunchConfirmed"]=role_cases_confirmed(cases,allowed_roles)
                    record["status"]="PASS" if record["actualLtiLaunchConfirmed"] else "FAIL"
        record["backendCleanupConfirmed"]=backend.get("cleanupConfirmed",False)
        record["backendSourceUnchanged"]=backend.get("sourceCloneUntouched",False)
        record["backendLogCategories"]=backend.get("backendLogCategories",[])
        record["backendFailureFrames"]=backend.get("backendFailureFrames",[])
        if not record["backendCleanupConfirmed"] or not record["backendSourceUnchanged"]:
            record["status"]="FAIL"
            record["actualLtiLaunchConfirmed"]=False
    except (SafeAbort,QABlocked,ProxyBlocked,OSError) as err:
        record["status"]="BLOCKED"
        record["reason"]=str(err) if isinstance(err,(SafeAbort,QABlocked,ProxyBlocked)) else type(err).__name__
    return record

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--pair",choices=("october","august"),default="october")
    p.add_argument("--report",required=True)
    p.add_argument("--roles",choices=("both","admin"),default="both")
    args=p.parse_args()
    os.environ["QA_LTI_SELECTED_ROLES"]=args.roles
    explicit_authorization()
    output=Path(args.report).resolve()
    if not output.is_relative_to(QA.resolve()):
        raise SafeAbort("Report path outside isolated QA artifacts")
    result=pair_experiment(args.pair,role="professor",lti_hook=launch_in_disposable_canvas)
    lti=result.get("isolatedLti") or {}
    complete=result.get("status")=="PASS_HTTP" and result.get("headlessStatus")=="PASS" and (
        lti.get("status")=="PASS" and lti.get("actualLtiLaunchConfirmed") and
        lti.get("backendCleanupConfirmed")) and result.get("cleanupConfirmed") is True
    report={"generatedAt":datetime.now(timezone.utc).isoformat(),
            "mode":"actual_plugin_real_lti_headless",
            "allOriginalDatabasesAndCodeUntouched":True,
            "interactiveMenuModified":False,
            "fullEndToEndConfirmed":bool(complete),
            "historicalPair":result}
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    output.chmod(0o600)
    print("QA_LTI_FULL_E2E",args.pair,"PASS",bool(complete),
          "CANVAS",result.get("status"),"CANVAS_CLEAN",result.get("cleanupConfirmed"),
          "BACKEND_CLEAN",lti.get("backendCleanupConfirmed"),"LTI",lti.get("status"),
          "ROLES",[(x.get("role"),x.get("status")) for x in lti.get("roles",[])])
    print("QA_LTI_FULL_E2E_REPORT",output)
    return 0 if complete else 2

if __name__=="__main__":
    try:sys.exit(main())
    except (SafeAbort,QABlocked,OSError,ValueError) as exc:
        print("QA_LTI_E2E_BLOCKED",type(exc).__name__,file=sys.stderr)
        sys.exit(3)
