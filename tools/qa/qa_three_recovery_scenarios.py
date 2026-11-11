#!/usr/bin/env python3
"""Disposable real Docker E2E for the three main-menu recovery scenarios.

No historical/normal user container is ever started, stopped, or deleted.
Only a randomly-named qa-compat-* Compose project is created and destroyed.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from datetime import datetime, timezone

from disposable_services import DisposableLab, QAFailed, ROOT, call

HERE=Path(__file__).resolve().parent
NODE=HERE/"execute_consented_recovery.mjs"
ARTIFACTS=Path.home()/"qa-feedback-20261110/artifacts"

def run_mode(lab,mode,extra=None):
    env={**lab.env,**(extra or {}), "PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY":"false"}
    result=call(["node",str(NODE),mode],env=env,check=False,timeout=100)
    found=[line.partition("QA_CONSENTED_RECOVERY=")[2] for line in result.stdout.splitlines()
           if line.startswith("QA_CONSENTED_RECOVERY=")]
    if len(found)!=1:
        raise QAFailed("No structured result from disposable recovery runner")
    return result.returncode,json.loads(found[0])

def sentinel(lab):
    command=["docker","exec",lab.container("db"),"psql","-U","postgres",
             "-d","feedback_plugin_db","-X","-q","-A","-t","-v","ON_ERROR_STOP=1"]
    sql="CREATE TABLE IF NOT EXISTS qa_recovery_persistence (id int primary key); INSERT INTO qa_recovery_persistence VALUES (37) ON CONFLICT DO NOTHING;"
    # pg_isready may briefly succeed while the container's initial database
    # setup is still settling. Retry only this idempotent QA-only sentinel.
    # Identity is re-checked on every attempt; no historical DB is eligible.
    for attempt in range(3):
        lab.inspect("db")
        result=call(command+["-c",sql],timeout=20,check=False)
        if result.returncode==0:
            return command
        if attempt<2:time.sleep(2)
    raise QAFailed("Disposable PostgreSQL sentinel could not be initialized after bounded retries")

def check_sentinel(command):
    answer=call(command+["-c","SELECT count(*) FROM qa_recovery_persistence WHERE id=37;"],timeout=20)
    if answer.stdout.strip()!="1":raise QAFailed("Disposable database sentinel lost")

def require(condition,description):
    if not condition:raise QAFailed(description)

def test_matrix(lab):
    lab.start()
    database=sentinel(lab)
    lab.case("test1_normal_healthy_no_side_effect",lambda: (
        require(run_mode(lab,"plan")[1]["kind"]=="reuse","Healthy main flow did not reuse"),
        require(lab.state("db")=="healthy" and lab.state("gotenberg")=="healthy",
                "Healthy containers changed"),
        check_sentinel(database),
        "unchanged_healthy_shared_dependencies"
    )[-1])
    def single():
        lab.stop("db")
        try:
            code,candidate=run_mode(lab,"candidate")
            require(code==0 and candidate["kind"]=="recoverable" and len(candidate["stopped"])==1,
                    "Single stopped database not recognized")
            code,response=run_mode(lab,"approve")
            require(code==0 and response["kind"]=="reuse" and
                    response["recovered"]==[lab.container("db")],
                    "A single stopped database was not recovered after consent")
            lab.clean()
            check_sentinel(database)
            return "one_owned_stopped_service_recovered_without_reinstall"
        finally:
            lab.restore("db")
    lab.case("test2_single_stopped_service",single)
    def third():
        lab.stop("db");lab.stop("gotenberg")
        try:
            code,blocked=run_mode(lab,"plan")
            require(blocked["kind"]=="block","Historical Fast Boot block not reproduced")
            code,candidate=run_mode(lab,"candidate")
            require(code==0 and candidate["kind"]=="recoverable" and len(candidate["stopped"])==2,
                    "Exact historical double-stop not recoverable")
            code,denied=run_mode(lab,"decline")
            require(denied["kind"]=="block" and lab.state("db")=="stopped" and lab.state("gotenberg")=="stopped",
                    "Declined recovery unexpectedly modified stopped services")
            code,recovered=run_mode(lab,"approve")
            require(code==0 and recovered["kind"]=="reuse" and
                    set(recovered["recovered"])=={lab.container("db"),lab.container("gotenberg")},
                    "Two stopped owned containers did not recover")
            lab.clean()
            check_sentinel(database)
            return "both_stopped_prior_block_now_recovers_after_explicit_consent"
        finally:
            lab.restore("db");lab.restore("gotenberg")
    lab.case("test3_original_double_stop_without_env_optin",third)

    def reject_override(changes,mode="candidate"):
        lab.stop("gotenberg")
        try:
            code,result=run_mode(lab,mode,changes)
            require(result["kind"]=="block" and lab.state("gotenberg")=="stopped",
                    "Conflict ignored or container modified without consent")
            return "safely_blocked_unchanged"
        finally:
            lab.restore("gotenberg")
    lab.case("negative_foreign_compose_project",lambda: reject_override(
        {"COMPOSE_PROJECT_NAME":"qa-compat-00000000"}),"blocked")
    lab.case("negative_wrong_db_credentials",lambda: reject_override({"DB_PASSWORD":"intentionally-wrong"}),"blocked")
    lab.case("negative_wrong_published_port",lambda: reject_override({"DB_PORT":"1"}),"blocked")
    lab.case("negative_unattended_requires_explicit_optin",lambda: reject_override(
        {"NON_INTERACTIVE":"true"},"approve"),"blocked")
    return lab.results

def main():
    if os.getenv("QA_ALLOW_DISPOSABLE_COMPAT_TESTS")!="true" or (
        os.getenv("PLUGIN_TEST_MODE")!="true" or os.getenv("PLUGIN_QA_NO_BROWSER")!="true"
    ):raise QAFailed("Three opt-ins required for disposable Docker recovery")
    if len(sys.argv)!=2:raise QAFailed("A single report path is required")
    ARTIFACTS.mkdir(mode=0o700,parents=True,exist_ok=True)
    target=Path(sys.argv[1]).resolve()
    if not target.is_relative_to(ARTIFACTS.resolve()):
        raise QAFailed("Report path must be under isolated QA artifacts")
    lab=DisposableLab()
    failure=None
    failure_category=None
    try:test_matrix(lab)
    except Exception as exc:
        failure=type(exc).__name__
        # QAFailed messages contain only internal QA operation names and
        # fixed, sanitized error classes; never serialize raw Docker logs.
        failure_category=str(exc)[:160] if isinstance(exc,QAFailed) else failure
    finally:cleaned=lab.cleanup()
    results={
        "date":datetime.now(timezone.utc).isoformat(),
        "project":lab.project,
        "mode":"three_scenario_real_docker_consumable_qa",
        "originalUserContainersModified":False,
        "menuModified":False,
        "cleanupConfirmed":cleaned,
        "startupFailure":failure,
        "startupFailureCategory":failure_category,
        "scenarios":lab.results
    }
    target.write_text(json.dumps(results,ensure_ascii=False,indent=2)+"\n")
    target.chmod(0o600)
    passes=sum(case["status"]=="PASS" for case in lab.results)
    print("QA_THREE_RECOVERY_SCENARIOS",passes,"/",len(lab.results),
          "CLEAN",cleaned,"STARTUP_FAILURE",failure)
    print("QA_THREE_RECOVERY_REPORT",target)
    return 0 if cleaned and not failure and len(lab.results)==7 and passes==7 else 2

if __name__=="__main__":
    try:sys.exit(main())
    except (QAFailed,OSError,ValueError) as exc:
        print("QA_THREE_RECOVERY_BLOCKED",type(exc).__name__,file=sys.stderr)
        sys.exit(3)
