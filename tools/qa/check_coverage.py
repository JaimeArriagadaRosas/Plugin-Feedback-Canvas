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

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docker-report",required=True)
    parser.add_argument("--browser-report",required=True)
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    qa_root=Path.home()/"qa-feedback-20261110/artifacts"
    report_paths=[Path(x).resolve() for x in (args.docker_report,args.browser_report,args.output)]
    if any(not location.is_relative_to(qa_root) for location in report_paths):
        raise RuntimeError("Reports must stay within the isolated QA artifact directory.")
    docker=json.loads(report_paths[0].read_text())
    browser=json.loads(report_paths[1].read_text())
    docker_result=check_report(docker,DOCKER,requires_cleanup=True)
    browser_result=check_report(browser,BROWSER)
    total={
        "generatedAt":datetime.now(timezone.utc).isoformat(),
        "mode":"reconciliation_only_no_commands_no_migrations",
        "disposableDocker":docker_result,
        "headlessCanvasLti":browser_result,
        "passedE2E":docker_result["verified"]+browser_result["verified"],
        "totalExpectedE2E":len(DOCKER)+len(BROWSER),
        "unverifiedScenarios":list(GAPS),
        "completeForTestedScenarios":docker_result["ok"] and browser_result["ok"],
        "allHistoricalCanvasCompatibilityVerified":False,
    }
    report_paths[2].write_text(json.dumps(total,ensure_ascii=False,indent=2)+"\n")
    report_paths[2].chmod(0o600)
    print("QA_COMPAT_COVERAGE",total["passedE2E"],"/",total["totalExpectedE2E"],
          "ALL_VERIFIED",total["completeForTestedScenarios"],
          "PENDING",len(GAPS),"REPORT",report_paths[2])
    return 0 if total["completeForTestedScenarios"] else 1

if __name__=="__main__":
    try:sys.exit(main())
    except (OSError,ValueError,RuntimeError) as error:
        print("QA_COMPAT_COVERAGE_BLOCKED",type(error).__name__,file=sys.stderr)
        sys.exit(3)
