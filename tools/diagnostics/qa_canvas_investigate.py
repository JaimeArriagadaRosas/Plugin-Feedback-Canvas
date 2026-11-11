#!/usr/bin/env python3
"""One-shot isolated Canvas investigation: snapshot, config provenance, Rails shard trace, optional headless.

Nothing schedules itself or keeps a watcher running. Every subcommand has its own QA identity guard.
"""
import argparse
import json
import os
import re
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

HERE=Path(__file__).resolve().parent
QA_ROOT=Path.home()/"qa-feedback-20261110"
ARTIFACTS=QA_ROOT/"artifacts"

def check_result(path, returncode):
    if returncode or not path.is_file():
        return {"ok":False,"result":"not_completed"}
    try:
        payload=json.loads(path.read_text(encoding="utf-8"))
        return {"ok":True,"report":payload}
    except (OSError, ValueError):
        return {"ok":False,"result":"invalid_report"}

def run_tool(name, script, report, env, *, max_seconds):
    command=[sys.executable,str(HERE/script),"--report",str(report)]
    try:
        r=subprocess.run(command,cwd=str(HERE.parent.parent),env=env,
                         stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                         text=True,timeout=max_seconds,check=False)
        print("QA_WORKFLOW",name,"PASS" if r.returncode==0 else "FAILED",
              "exit="+str(r.returncode))
        return check_result(report,r.returncode)
    except subprocess.TimeoutExpired:
        print("QA_WORKFLOW",name,"TIMED_OUT")
        return {"ok":False,"result":"timed_out"}

def headless_qa_owner_verified():
    # Do not send even synthetic credentials to an unrelated listener on 8443.
    try:
        listeners=subprocess.run(["ss","-lntp"],capture_output=True,text=True,
                                 timeout=8,check=False)
        if listeners.returncode:return False
        expected=(QA_ROOT/"clean/Plugin-Feedback-Canvas").resolve()
        for line in listeners.stdout.splitlines():
            if not re.search(r":8443\s",line):continue
            matches=re.findall(r"pid=(\d+)",line)
            if len(set(matches))!=1:continue
            process_id=matches[0]
            cwd=Path("/proc")/process_id/"cwd"
            argv=Path("/proc")/process_id/"cmdline"
            if (cwd.resolve()==expected and argv.is_file()
                    and b"apps/installer/src/preboot.js" in argv.read_bytes()):
                return True
    except (OSError,subprocess.TimeoutExpired,RuntimeError):
        return False
    return False

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-headless",action="store_true",
                        help="Run browser login/LTI only against prestarted isolated QA")
    parser.add_argument("--report")
    args=parser.parse_args()
    if os.getenv("QA_ALLOW_CANVAS_CAUSAL_LAB")!="true":
        raise RuntimeError("QA_ALLOW_CANVAS_CAUSAL_LAB=true required")
    ARTIFACTS.mkdir(parents=True,exist_ok=True)
    stamp=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output=Path(args.report).resolve() if args.report else ARTIFACTS/("qa-canvas-causal-"+stamp+".json")
    if not str(output).startswith(str(QA_ROOT)+os.sep):
        raise RuntimeError("Report path must be inside the QA directory")
    child_env={**os.environ,"QA_ALLOW_HISTORY_LAB":"true","QA_ALLOW_SHARD_TRACE":"true"}
    tasks=[
      ("snapshot", "qa_canvas_history_lab.py", 180),
      ("dockerPersistence", "qa_canvas_persistence_matrix.py", 45),
      ("railsShardTrace", "qa_canvas_shard_trace.py", 180)
    ]
    suite={"timestamp":datetime.now(timezone.utc).isoformat(),
           "qaProject":"qa-feedback-20261110",
           "backgroundChecks":False,"productionDataModified":False,
           "stages":{},"headless":None}
    for name,script,timeout in tasks:
        report=ARTIFACTS/("qa-causal-"+stamp+"-"+name+".json")
        suite["stages"][name]=run_tool(name,script,report,child_env,max_seconds=timeout)
    if args.with_headless:
        env_names=("QA_ADMIN_USER","QA_PROFESSOR_USER","QA_STUDENT_USER","QA_LOGIN_PASSWORD")
        missing=[k for k in env_names if not child_env.get(k)]
        if missing:
            suite["headless"]={"ok":False,"result":"required_qa_credentials_not_configured"}
            print("QA_WORKFLOW headless SKIPPED: synthetic QA credentials unavailable")
        elif not headless_qa_owner_verified():
            suite["headless"]={"ok":False,"result":"port_8443_not_owned_by_qa"}
            print("QA_WORKFLOW headless BLOCKED: HTTPS listener not owned by isolated QA")
        else:
            child_env["QA_CANVAS_URL"]="https://localhost:8443"
            child_env["QA_SCREENSHOT_DIR"]=str(ARTIFACTS/("qa-headless-"+stamp))
            runner=HERE/"qa_headless_suite.sh"
            try:
                result=subprocess.run(["bash",str(runner)],env=child_env,
                                      cwd=str(HERE.parent.parent),capture_output=True,
                                      text=True,timeout=600,check=False)
                suite["headless"]={"ok":result.returncode==0,
                                   "result":"passed" if result.returncode==0 else "failed"}
                print("QA_WORKFLOW headless",suite["headless"]["result"])
            except subprocess.TimeoutExpired:
                suite["headless"]={"ok":False,"result":"timed_out"}
    snapshot=suite["stages"]["snapshot"]
    persistence=suite["stages"]["dockerPersistence"]
    shard=suite["stages"]["railsShardTrace"]
    suite["findings"]={
      "account_fk_can_be_rejected_in_snapshot":
          bool(snapshot.get("ok") and any(
             x["scenario"]=="stale_global_id_on_terms" and x["passed"]
             for x in snapshot["report"].get("scenarios",[]))),
      "historical_postgres_container_ambiguity":
          bool(persistence.get("ok") and persistence["report"]
               .get("historicalServiceCandidateCounts",{}).get("postgres",0)>1),
      "global_account_id_unresolvable_in_single_shard_qa":
          bool(shard.get("ok") and not shard["report"].get("trace",{}).
               get("targetShardResolvable",True)),
      "original_professor_root_cause_confirmed":False
    }
    suite["limitations"]=[
        "The snapshot tests exercise PostgreSQL transitions, not a normal Canvas Rails login.",
        "One shard in QA does not reproduce a real multi-shard deployment.",
        "Historical container label ambiguity is a risk, not proof of the professor's failure.",
        "No data repairs are authorized by these results."
    ]
    output.write_text(json.dumps(suite,indent=2,ensure_ascii=False)+"\n")
    output.chmod(0o600)
    print("QA_CAUSAL_SUMMARY",str(output))
    total_ok=all(s.get("ok") for s in suite["stages"].values())
    if args.with_headless:total_ok=total_ok and bool(suite["headless"]["ok"])
    return 0 if total_ok else 1

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as error:
        print("QA causal workflow blocked:",str(error),file=sys.stderr)
        sys.exit(3)
