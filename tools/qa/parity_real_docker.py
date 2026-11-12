#!/usr/bin/env python3
"""Real, isolated Docker comparison of the same QA recovery scenarios.

Intentionally does not use the caller's existing Canvas containers or databases.
Run one Git revision at a time. All QA evidence must be stored on the D: drive.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import importlib
import json
import os
from pathlib import Path
import subprocess
import sys

ALLOWED_DATA_ROOT = Path("/mnt/d/Documentos/MDL/Informatico/Plugin-Feedback-Parity-QA")
OPT_INS = ("QA_ALLOW_DISPOSABLE_COMPAT_TESTS", "PLUGIN_TEST_MODE", "PLUGIN_QA_NO_BROWSER")
def require(value, message):
    if not value:
        raise RuntimeError(message)

def git_commit(source: Path) -> str:
    command = subprocess.run(
        ["git", "-C", str(source), "rev-parse", "HEAD"],
        capture_output=True, text=True, timeout=15
    )
    require(command.returncode == 0, "QA source must be a Git revision")
    return command.stdout.strip()

def docker_baseline():
    proc = subprocess.run(
        ["docker", "ps", "-a", "--format", "{{.ID}}|{{.Names}}|{{.Status}}"],
        capture_output=True, text=True, timeout=35
    )
    require(proc.returncode == 0, "Docker daemon not available")
    return sorted(line for line in proc.stdout.splitlines() if
                  not line.split("|")[1].startswith("qa-compat-"))

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", required=True, help="Git source revision under the authorized workspace")
    ap.add_argument("--report", required=True, help="D: evidence report JSON")
    ap.add_argument("--suite", choices=("three", "full"), default="three")
    args = ap.parse_args()

    for flag in OPT_INS:
        require(os.environ.get(flag) == "true", "Missing explicit isolated QA opt-in: " + flag)
    source = Path(args.source).resolve(strict=True)
    require((source / "tools/qa/disposable_services.py").is_file(), "Missing QA source")
    require(source == Path("/home/jaime/proyectos/Plugin-Feedback-Canvas") or
            source.is_relative_to(ALLOWED_DATA_ROOT.resolve()),
            "QA source outside approved repository or D-drive laboratory")
    report = Path(args.report).resolve()
    root = ALLOWED_DATA_ROOT.resolve(strict=True)
    require(report.suffix == ".json" and report.is_relative_to(root),
            "QA evidence must remain under the approved D-drive laboratory")
    require(not report.is_symlink(), "Report must not be a symlink")
    report.parent.mkdir(mode=0o700, parents=True, exist_ok=True)

    # Import the exact source revision's recovery logic and QA runner, not the
    # user's working directory or a shared test module from another branch.
    sys.path.insert(0, str(source / "tools/qa"))
    services = importlib.import_module("disposable_services")
    if args.suite == "three":
        recovery = importlib.import_module("qa_three_recovery_scenarios")
    before = docker_baseline()
    lab = services.DisposableLab()
    startup_failure = None
    try:
        if args.suite == "three":
            recovery.test_matrix(lab)
        else:
            lab.run()
    except Exception as exc:
        # No raw exception, credentials, ports or Docker output in evidence.
        startup_failure = type(exc).__name__
    finally:
        cleanup = lab.cleanup()

    after = docker_baseline()
    baseline_unchanged = before == after
    results = lab.results
    passed = sum(item["status"] == "PASS" for item in results)
    expected_cases = 7 if args.suite == "three" else None
    valid = (cleanup and baseline_unchanged and startup_failure is None and
             passed == len(results) and bool(results) and
             (expected_cases is None or len(results) == expected_cases))
    evidence = {
        "schema": "qa-parity-real-docker-v1",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "sourceCommit": git_commit(source),
        "suite": args.suite,
        "dockerProject": lab.project,
        "disposableOnly": True,
        "cleanupConfirmed": cleanup,
        "unrelatedContainerStatusUnchanged": baseline_unchanged,
        "startupFailureClass": startup_failure,
        "passed": passed,
        "total": len(results),
        "status": "PASS" if valid else "FAIL",
        "scenarios": results,
    }
    report.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    report.chmod(0o600)
    print("QA_PARITY_REAL_DOCKER", args.suite, evidence["status"],
          f"{passed}/{len(results)}", "cleanup", cleanup,
          "other_containers_unchanged", baseline_unchanged, flush=True)
    print("QA_EVIDENCE", report, flush=True)
    return 0 if valid else 2

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print("QA_PARITY_BLOCKED", type(e).__name__, flush=True)
        sys.exit(3)
