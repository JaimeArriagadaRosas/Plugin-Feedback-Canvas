#!/usr/bin/env python3
"""Reconcile real one-shot QA results. NEVER marks skipped or missing scenarios as passing."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import sys

DOCKER = (
    "clean_install_services", "postgres_stopped_autorecovery",
    "gotenberg_stopped_autorecovery", "two_owned_services_stopped_recovery",
    "recovery_without_opt_in_blocks", "wrong_compose_owner_blocks",
    "wrong_published_port_blocks", "wrong_db_credentials_blocks",
    "missing_container_name_blocks", "redis_stopped_detected_without_unsafe_repair",
    "plugin_legacy_prefix_install", "plugin_legacy_migration_to_current",
    "plugin_migrations_idempotent", "plugin_unknown_version_blocks_without_write",
)
BROWSER = (
    "compat-admin-reload", "compat-admin-parallel_tabs", "compat-admin-clear_cookies",
    "compat-admin-tampered_cookie",
    "compat-professor-reload", "compat-professor-parallel_tabs", "compat-professor-clear_cookies",
    "compat-professor-tampered_cookie", "compat-student-login_only",
    "lti_admin", "lti_professor",
)
GAPS = (
    "historical_canvas_version_upgrade_e2e",
    "real_multi_shard_account_login",
    "original_professor_fk_without_injection",
    "external_occupied_port_e2e",
    "interrupted_full_canvas_setup_e2e",
)

def check_report(payload, expected, *, requires_cleanup=False):
    entries=payload.get("results")
    if not isinstance(entries,list):
        return {"ok":False,"issues":["missing_results"],"verified":0,"expected":len(expected)}
    seen={}
    duplicates=[]
    for entry in entries:
        name=entry.get("name",entry.get("case"))
        if name in seen: duplicates.append(name)
        seen[name]=entry.get("status")
    issues=[]
    if duplicates: issues.append("duplicate_case_id")
    if requires_cleanup and payload.get("cleanupConfirmed") is not True:
        issues.append("cleanup_unconfirmed")
    if payload.get("startupFailure"):issues.append("startup_failed")
    if payload.get("coverageIncomplete") is True:issues.append("coverage_incomplete")
    missing=[name for name in expected if name not in seen]
    if missing: issues.append("missing_cases:"+",".join(missing))
    incomplete=[name for name in expected if seen.get(name)!="PASS"]
    if incomplete: issues.append("not_passed:"+",".join(incomplete))
    extraneous=[name for name in seen if name not in expected]
    if extraneous:issues.append("unexpected_cases:"+",".join(extraneous))
    return {"ok":not issues,"issues":issues,
            "verified":sum(seen.get(name)=="PASS" for name in expected),
            "expected":len(expected)}

def check_remaining_scenarios(payload):
    expected = set(GAPS)
    scenarios = payload.get("cases")
    if not isinstance(scenarios, list):
        return {"ok":False, "verified":0, "issues":["missing_remaining_cases"], "pending":list(GAPS)}
    keys = [case.get("scenario") for case in scenarios]
    if len(keys) != len(set(keys)) or set(keys) != expected:
        return {"ok":False, "verified":0, "issues":["remaining_case_ids_mismatch"], "pending":list(GAPS)}
    statuses = {case["scenario"]:case.get("status") for case in scenarios}
    allowed = {
        "external_occupied_port_e2e":{"PASS"},
        "interrupted_full_canvas_setup_e2e":{"INTEGRATION_ONLY"},
        "historical_canvas_version_upgrade_e2e":{"NOT_VERIFIED"},
        "real_multi_shard_account_login":{"NOT_VERIFIED","READY_FOR_MANUAL_E2E"},
        "original_professor_fk_without_injection":{"NOT_REPRODUCED"}
    }
    issues=[key+"_unexpected_status" for key in GAPS if statuses[key] not in allowed[key]]
    passed=statuses["external_occupied_port_e2e"]=="PASS"
    return {
        "ok":not issues and passed,
        "verified":int(passed) if not issues else 0,
        "expected":1,
        "issues":issues,
        "pending":[key for key in GAPS if key != "external_occupied_port_e2e"] if passed else list(GAPS),
        "statuses":statuses
    }

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docker-report",required=True)
    parser.add_argument("--browser-report",required=True)
    parser.add_argument("--output",required=True)
    parser.add_argument("--remaining-report")
    args=parser.parse_args()
    qa_root=Path.home()/"qa-feedback-20261110/artifacts"
    report_paths=[Path(x).resolve() for x in (args.docker_report,args.browser_report,args.output,*([args.remaining_report] if args.remaining_report else []))]
    if any(not location.is_relative_to(qa_root) for location in report_paths):
        raise RuntimeError("Reports must stay within the isolated QA artifact directory.")
    docker=json.loads(report_paths[0].read_text())
    browser=json.loads(report_paths[1].read_text())
    docker_result=check_report(docker,DOCKER,requires_cleanup=True)
    browser_result=check_report(browser,BROWSER)
    remaining_result=check_remaining_scenarios(json.loads(report_paths[3].read_text())) if args.remaining_report else None
    additional=remaining_result["verified"] if remaining_result else 0
    total={
        "generatedAt":datetime.now(timezone.utc).isoformat(),
        "mode":"reconciliation_only_no_commands_no_migrations",
        "disposableDocker":docker_result,
        "headlessCanvasLti":browser_result,
        "remainingScenarios":remaining_result,
        "passedE2E":docker_result["verified"]+browser_result["verified"]+additional,
        "totalExpectedE2E":len(DOCKER)+len(BROWSER)+(1 if remaining_result else 0),
        "unverifiedScenarios":remaining_result["pending"] if remaining_result else list(GAPS),
        "completeForTestedScenarios":docker_result["ok"] and browser_result["ok"] and (remaining_result is None or remaining_result["ok"]),
        "allHistoricalCanvasCompatibilityVerified":False,
    }
    report_paths[2].write_text(json.dumps(total,ensure_ascii=False,indent=2)+"\n")
    report_paths[2].chmod(0o600)
    print("QA_COMPAT_COVERAGE",total["passedE2E"],"/",total["totalExpectedE2E"],
          "ALL_VERIFIED",total["completeForTestedScenarios"],
          "PENDING",len(total["unverifiedScenarios"]),"REPORT",report_paths[2])
    return 0 if total["completeForTestedScenarios"] else 1

if __name__=="__main__":
    try:sys.exit(main())
    except (OSError,ValueError,RuntimeError) as error:
        print("QA_COMPAT_COVERAGE_BLOCKED",type(error).__name__,file=sys.stderr)
        sys.exit(3)
