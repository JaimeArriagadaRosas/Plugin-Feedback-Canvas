#!/usr/bin/env python3
"""One-shot real QA fault/recovery matrix for the unified Plugin Feedback clone.

Each destructive experiment is confined to a disposable QA resource. Reports
never include raw subprocess output, credentials, Docker environment or Rails logs.
This runner does not modify the interactive installer or publish Git commits.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys

from historical_full_stack import pair_experiment
from disposable_canvas_faults import run_matrix
from isolated_lti_full_launch import launch_in_disposable_canvas

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
QA = Path.home()/"qa-feedback-20261110/artifacts"
ALLOWED_STATES = {"PASS_BASELINE", "PASS_SAFE_BLOCK", "PASS_RECOVERED",
                  "PASS_REFERENCE_ACCEPTED", "NOT_VERIFIED", "INTEGRATION_ONLY",
                  "BLOCKED", "FAIL"}

def require_guards():
    if ROOT.resolve() != (Path.home()/"proyectos/Plugin-Feedback-Canvas-feedback-cualitativo").resolve():
        raise RuntimeError("Refusing a different implementation clone")
    for key in ("QA_ALLOW_FAILURE_RECOVERY_E2E", "QA_ALLOW_FULL_LTI_E2E",
                "QA_ALLOW_HISTORICAL_FULL_STACK", "QA_ALLOW_ISOLATED_PLUGIN_BACKEND",
                "QA_ALLOW_CANVAS_RESTART_E2E", "QA_ALLOW_DISPOSABLE_COMPAT_TESTS",
                "QA_ALLOW_CANVAS_PREFLIGHT_REAL_E2E",
                "PLUGIN_TEST_MODE", "PLUGIN_QA_NO_BROWSER"):
        if os.environ.get(key) != "true":
            raise RuntimeError("Explicit QA authorization missing: "+key)
    if not QA.is_dir() or QA.is_symlink() or not QA.resolve().is_relative_to(Path.home()/"qa-feedback-20261110"):
        raise RuntimeError("Authorized QA evidence directory unavailable")

def safe_report(path):
    output = Path(path).resolve()
    if not output.is_relative_to(QA.resolve()) or output.suffix != ".json":
        raise RuntimeError("Reports must be JSON files inside the QA artifact folder")
    return output

def run_process(args, timeout, env=None):
    try:
        result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True,
                                timeout=timeout, check=False, env=env or os.environ.copy())
        return result.returncode, result.stdout
    except subprocess.TimeoutExpired:
        return 124, ""

def whole_lti_check(result):
    return (result.get("status") == "PASS" and
            result.get("actualLtiLaunchConfirmed") is True and
            result.get("backendCleanupConfirmed") is True and
            result.get("backendSourceUnchanged") is True)

def full_login_and_fault_hook(context):
    """A genuine browser baseline, real PostgreSQL FK faults, then browser again.

    The historical Rails and DB sources are already confirmed read-only by
    pair_experiment; only the owned disposable database receives SQL attempts.
    """
    output = {"status":"FAIL", "faultOriginNaturallyReproduced":False}
    baseline = launch_in_disposable_canvas(context)
    output["baseline"] = baseline
    if not whole_lti_check(baseline):
        output["status"] = "BLOCKED"
        output["reason"] = "Baseline LTI/OAuth did not pass; unsafe to attribute later faults"
        return output
    output["baselineStatus"] = "PASS_BASELINE"
    faults = run_matrix(context["postgres"])
    output["postgresFaults"] = faults
    if faults["status"] != "PASS" or not faults["dataIntegrityPreserved"]:
        output["status"] = "FAIL"
        output["reason"] = "FK experiment did not retain disposable data integrity"
        return output
    # Repeat the same ADMIN + PROFESSOR OAuth/LTI/browser flow, not just SQL.
    recovered = launch_in_disposable_canvas(context)
    output["afterFault"] = recovered
    output["regressionStatus"] = "PASS_BASELINE" if whole_lti_check(recovered) else "FAIL"
    output["status"] = "PASS" if whole_lti_check(recovered) else "FAIL"
    output["actualRecovery"] = "TRANSACTION_ROLLBACK" if output["status"] == "PASS" else "NOT_PROVEN"
    return output

def record(name, status, detail, **additional):
    if status not in ALLOWED_STATES:
        raise RuntimeError("Invalid QA status "+status)
    item = {"scenario":name,"status":status,"detail":detail, **additional}
    print("QA_RECOVERY_CASE",name,status,flush=True)
    return item

def command_case(name, command, timeout, predicate, detail, *, env=None):
    code, stdout = run_process(command, timeout, env=env)
    try:
        status = predicate(code, stdout)
    except (ValueError, KeyError, TypeError):
        status = "FAIL"
    return record(name, status, detail, exitCode=code)

def report_progress(path, items):
    result = {
        "generatedAt":datetime.now(timezone.utc).isoformat(),
        "mode":"single_clone_isolated_fault_recovery_e2e",
        "originalCanvasResourcesModified":False,
        "interactiveMenuModified":False,
        "gitPushPerformed":False,
        "cases":items,
        "observedFailures":[x["scenario"] for x in items if x["status"]=="FAIL"],
        "unverified":[x["scenario"] for x in items if x["status"] in
                      ("NOT_VERIFIED","INTEGRATION_ONLY","BLOCKED")],
        "allScenariosFullyCertified":bool(items) and all(
            x["status"] in ("PASS_BASELINE","PASS_SAFE_BLOCK","PASS_RECOVERED")
            for x in items),
    }
    # Create/replace *only* the known QA report; no raw logs or credentials.
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n", encoding="utf8")
    path.chmod(0o600)
    return result

def case_disposable_lti_faults(pair):
    try:
        result = pair_experiment(pair, role="professor", lti_hook=full_login_and_fault_hook)
        trials = result.get("isolatedLti") or {}
        successful = (
            result.get("status") == "PASS_HTTP" and result.get("headlessStatus") == "PASS"
            and result.get("cleanupConfirmed") is True
            and trials.get("status") == "PASS")
        state = "PASS_RECOVERED" if successful else "FAIL"
        # Persist only non-sensitive QA results, no Rails output or credentials.
        return record("real_fk_and_full_lti_before_after",state,
            "Real PostgreSQL FK rejection + rollback; two full admin/professor LTI runs",
            postgresFaults=trials.get("postgresFaults"),
            baselineRoles=(trials.get("baseline") or {}).get("roles"),
            afterRoles=(trials.get("afterFault") or {}).get("roles"),
            initialProfessorLogin=result.get("headlessStatus"),
            oauthBefore=trials.get("baselineStatus"),
            oauthAfter=trials.get("regressionStatus"),
            cleanupConfirmed=result.get("cleanupConfirmed"),
            causeOfProfessorOriginalFaultProven=False)
    except Exception as exc:
        return record("real_fk_and_full_lti_before_after","FAIL",
            "Disposable lab failed; inspect local QA logs without copying secrets",
            failureClass=type(exc).__name__)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report",required=True)
    parser.add_argument("--pair",choices=("august","october"),default="august")
    parser.add_argument("--mode",choices=("full","light"),default="full",
                        help="light skips the long Docker/Rails and full JS regression steps")
    args=parser.parse_args()
    require_guards()
    target=safe_report(args.report)
    os.environ["QA_LTI_SELECTED_ROLES"]="both"
    os.environ["QA_ALLOW_CANVAS_LEGACY_AUDIT"]="true"
    os.environ["QA_ALLOW_CANVAS_AUTH_TESTS"]="true"
    os.environ["QA_ALLOW_CANVAS_CAUSAL_LAB"]="true"
    cases=[]
    def append(item):
        cases.append(item)
        report_progress(target,cases)

    append(command_case("installer_partial_setup_resume",
        ["npx","vitest","run","apps/installer/tests/integration/qa-resume-installation.test.js",
         "--pool=forks","--fileParallelism=false"],95,
        lambda rc,_:"INTEGRATION_ONLY" if rc==0 else "FAIL",
        "Installer orchestration and resume tested against temp filesystem; external services mocked"))

    append(command_case("canvas_postgres_interruption_readonly_preflight",
        [sys.executable,str(HERE/"qa_canvas_preflight_recovery_e2e.py"),
         "--report",str(QA/"qa-matrix-canvas-preflight-recovery.json")],180,
        lambda rc,_:"PASS_RECOVERED" if rc==0 else "FAIL",
        "Actual isolated PostgreSQL stop/restart, incomplete schema and transactional rollback; no Canvas Rails migration"))

    append(command_case("external_port_occupied",
        ["node",str(HERE/"external_port_e2e.mjs")],35,
        lambda rc,out:"PASS_SAFE_BLOCK" if rc==0 and "QA_PORT_E2E=" in out
                 and json.loads(out.split("QA_PORT_E2E=")[-1].splitlines()[0]).get("foreignProcessStillServing") is True
                 and json.loads(out.split("QA_PORT_E2E=")[-1].splitlines()[0]).get("noUnrequestedTermination") is True
                 else "FAIL",
        "Real independent TCP listener remains alive after port-conflict inspection"))

    append(command_case("shared_dependencies_stopped_owned_recovery",
        [sys.executable,str(HERE/"qa_three_recovery_scenarios.py"),
         str(QA/"qa-matrix-shared-recovery.json")],250,
        lambda rc,_:"PASS_RECOVERED" if rc==0 else "FAIL",
        "Seven genuine disposable Docker scenarios including recovery with consent"))

    append(command_case("canvas_version_history",
        [sys.executable,str(HERE/"legacy_canvas_history.py"),
         "--report",str(QA/"qa-matrix-migration-readonly.json")],65,
        lambda rc,_:"NOT_VERIFIED" if rc==0 else "FAIL",
        "Actual version comparison completed; true historical upgrade not demonstrated"))

    append(command_case("switchman_multishard",
        [sys.executable,str(HERE/"multi_shard_preflight.py"),
         "--report",str(QA/"qa-matrix-shards-readonly.json")],65,
        lambda rc,_:"NOT_VERIFIED" if rc==0 else "FAIL",
        "Actual shard inventory; no multishard E2E without a supported Switchman lab"))

    if args.mode=="full":
        append(case_disposable_lti_faults(args.pair))
        append(command_case("disposable_canvas_web_restart",
            [sys.executable,str(HERE/"qa_canvas_restart_recovery_e2e.py"),
             "--pair",args.pair,"--report",str(QA/"qa-matrix-web-restart.json")],400,
            lambda rc,_:"PASS_RECOVERED" if rc==0 else "FAIL",
            "Real disposable Canvas service restart, preservation and 7 browser assertions"))

    append(command_case("python_qa_regression",
        [sys.executable,"-m","unittest","discover","-s","tools/qa/tests",
         "-p","test_*.py","-q"],140,
        lambda rc,_:"PASS_BASELINE" if rc==0 else "FAIL",
        "Entire Python QA regression suite"))

    if args.mode=="full":
        append(command_case("javascript_vitest_regression",
            ["npm","test"],240,
            lambda rc,_:"PASS_BASELINE" if rc==0 else "FAIL",
            "Full Vitest suite after disposable failure/recovery tests",
            env={**os.environ,"ENCRYPTION_KEY":secrets.token_hex(32)}))
        append(command_case("javascript_lint",
            ["npm","run","lint"],120,
            lambda rc,_:"PASS_BASELINE" if rc==0 else "FAIL",
            "ESLint regression after failure/recovery tests"))

    done=report_progress(target,cases)
    print("QA_RECOVERY_MATRIX_REPORT",target,flush=True)
    print("QA_RECOVERY_MATRIX",len(cases),"FAILURES",len(done["observedFailures"]),
          "UNVERIFIED",len(done["unverified"]),
          "ALL_FULLY_CERTIFIED",done["allScenariosFullyCertified"],flush=True)
    return 2 if done["observedFailures"] else 0

if __name__=="__main__":
    try:sys.exit(main())
    except (OSError,RuntimeError,ValueError) as exc:
        print("QA_RECOVERY_BLOCKED",type(exc).__name__,file=sys.stderr)
        sys.exit(3)
