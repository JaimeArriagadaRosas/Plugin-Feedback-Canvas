#!/usr/bin/env python3
"""One-shot runner for the five open Canvas compatibility questions.

Never performs migrations, repairs, browser launches, or service restarts.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
QA_ROOT=Path.home()/"qa-feedback-20261110"
ARTIFACTS=QA_ROOT/"artifacts"

def verified_flags():
    for flag in ("QA_ALLOW_CANVAS_CAUSAL_LAB","PLUGIN_TEST_MODE","PLUGIN_QA_NO_BROWSER"):
        if os.getenv(flag)!="true":
            raise RuntimeError("Explicit one-shot isolated QA and no-browser flags required")
    if not ARTIFACTS.is_dir():raise RuntimeError("QA artifact directory unavailable")

def execute(name, command, env, timeout):
    try:
        result=subprocess.run(command,cwd=ROOT,env=env,text=True,capture_output=True,
                              timeout=timeout,check=False)
        return result.returncode,result.stdout
    except subprocess.TimeoutExpired:
        return 124,""

def report_data(filename):
    file=ARTIFACTS/filename
    try:
        return json.loads(file.read_text(encoding="utf8"))
    except (OSError,ValueError):
        return None

def collect():
    verified_flags()
    os.environ["QA_ALLOW_CANVAS_LEGACY_AUDIT"]="true"
    os.environ["QA_ALLOW_CANVAS_AUTH_TESTS"]="true"
    os.environ["QA_ALLOW_DISPOSABLE_COMPAT_TESTS"]="true"
    env=os.environ.copy()
    stamp=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    cases=[]
    def add(name,status,evidence):
        cases.append({"scenario":name,"status":status,"evidence":evidence})
        print("QA_PENDING_SCENARIO",name,status,flush=True)

    port_rc,port_out=execute("port",["node",str(HERE/"external_port_e2e.mjs")],env,20)
    port_lines=[line.split("QA_PORT_E2E=",1)[1] for line in port_out.splitlines()
                if line.startswith("QA_PORT_E2E=")]
    try:
        port_data=json.loads(port_lines[-1]) if port_lines else {}
    except ValueError:
        port_data={}
    add("external_occupied_port_e2e",
        "PASS" if port_rc==0 and port_data.get("foreignProcessStillServing") and
                  port_data.get("noUnrequestedTermination") else "FAIL",
        "Independent listener still served PING after port-conflict preflight")

    integration_rc,_=execute("interrupted",["npx","vitest","run",
        "apps/installer/tests/integration/qa-resume-installation.test.js",
        "--pool=forks","--fileParallelism=false"],env,70)
    add("interrupted_full_canvas_setup_e2e",
        "INTEGRATION_ONLY" if integration_rc==0 else "FAIL",
        "Real EnvironmentSetup orchestration and partial filesystem recovery, external dependencies mocked")

    version_file="qa-remaining-"+stamp+"-migration-history.json"
    history_rc,_=execute("history",[sys.executable,str(HERE/"legacy_canvas_history.py"),
        "--report",str(ARTIFACTS/version_file)],env,40)
    history=report_data(version_file)
    add("historical_canvas_version_upgrade_e2e",
        "NOT_VERIFIED" if history_rc==0 and history and
                          history.get("current",{}).get("status")=="compatible" else "FAIL",
        "Read-only migration history verified; no historical source/database version upgraded")

    shard_file="qa-remaining-"+stamp+"-shards.json"
    shard_rc,_=execute("shards",[sys.executable,str(HERE/"multi_shard_preflight.py"),
        "--report",str(ARTIFACTS/shard_file)],env,40)
    shards=report_data(shard_file)
    shard_status=shards.get("result",{}).get("scenarioStatus") if shards else None
    add("real_multi_shard_account_login",
        "NOT_VERIFIED" if shard_rc==0 and shard_status=="SKIPPED" else
        "READY_FOR_MANUAL_E2E" if shard_rc==0 and shard_status=="READY_FOR_MANUAL_E2E" else "FAIL",
        "No real multi-shard login is performed; QA registered-shard preflight only")

    auth_file="qa-remaining-"+stamp+"-authentication.json"
    auth_rc,_=execute("authentication",[sys.executable,str(HERE/"authentication_e2e.py"),
        "--report",str(ARTIFACTS/auth_file)],env,450)
    auth=report_data(auth_file)
    login_cases=auth.get("results",[]) if auth else []
    passed=auth_rc==0 and len(login_cases)==9 and all(x.get("status")=="PASS" for x in login_cases)
    add("original_professor_fk_without_injection",
        "NOT_REPRODUCED" if passed else "FAIL",
        "Nine legitimate headless QA logins; no artificially injected Rails exception")

    return stamp,cases

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report",required=True)
    options=parser.parse_args()
    output=Path(options.report).resolve()
    if not output.is_relative_to(ARTIFACTS.resolve()):
        raise RuntimeError("Report path outside QA artifacts is not allowed")
    stamp,cases=collect()
    report={
        "timestamp":datetime.now(timezone.utc).isoformat(),
        "qaRun":stamp,
        "mode":"one_shot_no_browser",
        "originalDataModified":False,
        "cases":cases,
        "completeForAllFive":all(x["status"]=="PASS" for x in cases),
        "safeBlockersRemain":True
    }
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    output.chmod(0o600)
    print("QA_PENDING_SCENARIOS_REPORT",output)
    print("QA_PENDING_SUMMARY",json.dumps({x["scenario"]:x["status"] for x in cases}))
    # If no actual scenario failed, command succeeds while report keeps unresolved cases explicit.
    return 0 if all(x["status"]!="FAIL" for x in cases) else 1

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as error:
        print("QA remaining scenario execution safely blocked:",type(error).__name__,
              file=sys.stderr)
        sys.exit(3)
