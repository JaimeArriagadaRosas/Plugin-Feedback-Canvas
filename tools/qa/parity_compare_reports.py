#!/usr/bin/env python3
"""Compare independent Spanish-main and English real QA evidence without false passes."""
from __future__ import annotations

from datetime import datetime, timezone
import argparse
import json
from pathlib import Path
import subprocess
import sys

LAB = Path("/mnt/d/Documentos/MDL/Informatico/Plugin-Feedback-Parity-QA")
FILES = {
    "Real recovery with explicit consent": (
        "spanish-main-three-recovery.json", "english-three-recovery.json", "three"),
    "Owned services, negative gates and plugin migrations": (
        "spanish-main-full-dependency-recovery.json", "english-full-dependency-recovery.json", "full"),
    "Canvas/PostgreSQL interruption and resumable preflight": (
        "spanish-main-canvas-preflight.json", "english-canvas-preflight.json", "preflight"),
    "Synthetic PostgreSQL foreign key and incident diagnosis": (
        "spanish-main-canvas-fk.json", "english-canvas-fk.json", "foreign-key"),
}
REMAINING = [
    ("Real Canvas Rails installation from scratch on both branches",
     "NOT_VERIFIED", "Requires two isolated full Rails stacks and their own fixture databases"),
    ("Real LTI 1.3/OAuth with synthetic users in both isolated stacks",
     "NOT_VERIFIED", "Requires isolated Rails Canvas and plugin backend with browser"),
    ("Professor's exact login-controller exception",
     "NOT_VERIFIED", "A matching SQL constraint was reproduced; no complete Rails login trace"),
    ("Automatic recovery across a deliberately corrupted full Rails install",
     "NOT_VERIFIED", "Only disposable PostgreSQL and plugin dependency recovery were verified"),
]

def git_rev(root: Path, ref: str):
    p = subprocess.run(["git", "-C", str(root), "rev-parse", ref],
                       capture_output=True, text=True, timeout=12)
    if p.returncode:
        raise RuntimeError("Cannot verify source Git revision")
    return p.stdout.strip()

def read_optional(name):
    p = LAB / "reports" / name
    if not p.is_file() or p.is_symlink():
        return None
    return json.loads(p.read_text(encoding="utf8"))

def summarize(data, flavor):
    if flavor in ("three", "full"):
        require_fields = all(k in data for k in
                             ("sourceCommit", "status", "scenarios", "cleanupConfirmed",
                              "unrelatedContainerStatusUnchanged"))
        if not require_fields:
            return "FAIL", None
        cases = [(x["name"], x["status"]) for x in data["scenarios"]]
        okay = (data["status"] == "PASS" and data["cleanupConfirmed"] is True
                and data["unrelatedContainerStatusUnchanged"] is True
                and len(cases) > 0 and all(y == "PASS" for _, y in cases))
        return ("PASS" if okay else "FAIL"), cases
    if flavor == "preflight":
        detail = data.get("details", {})
        phases = [(s["stage"], s["observed"], s["passed"])
                  for s in detail.get("stages", [])]
        okay = (detail.get("status") == "PASS_RECOVERED"
                and detail.get("cleanupConfirmed") is True
                and data.get("otherContainersUnchanged") is True
                and detail.get("transactionRollbackProven") is True
                and len(phases) == 6
                and all(x[2] is True for x in phases))
        return ("PASS" if okay else "FAIL"), phases
    if flavor == "foreign-key":
        d = data.get("details", {})
        conditions = ("actualPostgresqlFkViolation",
                      "referentialIntegrityPreserved", "cleanupConfirmed",
                      "unsafeAutomaticResetRejected")
        okay = (d.get("status") == "PASS"
                and all(d.get(k) is True for k in conditions)
                and d.get("diagnosticCode") == "CANVAS_TERMS_FOREIGN_KEY"
                and d.get("fullRailsLoginReproduced") is False
                and data.get("otherContainersUnchanged") is True)
        return ("PASS" if okay else "FAIL"), [(key, d.get(key)) for key in conditions]
    return "FAIL", None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default="/home/jaime/proyectos/Plugin-Feedback-Canvas")
    args = parser.parse_args()
    repo = Path(args.repo).resolve(strict=True)
    root = LAB.resolve(strict=True)
    assert root.is_dir() and not LAB.is_symlink()
    en_commit = git_rev(repo, "HEAD")
    es_commit = git_rev(repo, "origin/main")
    rows = []
    for name, (esfile, enfile, flavor) in FILES.items():
        source_es, source_en = read_optional(esfile), read_optional(enfile)
        if source_es is None or source_en is None:
            status = "NOT_VERIFIED"
            reason = "One or both independent evidence files are missing"
            n = 0
        elif source_es.get("sourceCommit") != es_commit or source_en.get("sourceCommit") != en_commit:
            status = "FAIL"
            reason = "Evidence is not tied to the reference commits"
            n = 0
        else:
            es_result, es_cases = summarize(source_es, flavor)
            en_result, en_cases = summarize(source_en, flavor)
            n = len(es_cases or [])
            status = "PASS" if (es_result == en_result == "PASS" and
                                es_cases == en_cases) else "FAIL"
            reason = ("Same scenario names and outcomes on both revisions"
                      if status == "PASS" else
                      "Missing, failing, or differing scenario evidence")
        rows.append({"scenario": name, "status": status,
                     "comparedChecks": n, "reason": reason,
                     "spanishEvidence": esfile, "englishEvidence": enfile})
    report = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "spanishCommit": es_commit,
        "englishCommit": en_commit,
        "comparison": rows,
        "unverified": [dict(scenario=a, status=b, reason=c) for a,b,c in REMAINING],
        "realChecksCompared": sum(x["comparedChecks"] for x in rows if x["status"]=="PASS"),
        "allAvailableComparedChecksPass": all(x["status"]=="PASS" for x in rows),
        "completeFunctionalParityProven": False, # full Rails/LTI E2E remains unverified
    }
    out_dir = root / "reports"
    target = out_dir / "parity-comparison.json"
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n",encoding="utf8")
    target.chmod(0o600)
    markdown = [
        "# Plugin Feedback — real Docker QA parity",
        "",
        f"Spanish reference: `{es_commit[:12]}`",
        f"English revision: `{en_commit[:12]}`",
        "",
        "| Scenario | Compared checks | Result |",
        "|---|---:|---|",
    ]
    markdown += [f"| {x['scenario']} | {x['comparedChecks']} | {x['status']} |"
                 for x in rows]
    markdown += ["", f"**Compared real checks passed:** {report['realChecksCompared']}",
                 "", "## Not yet verified", ""]
    markdown += [f"- **{x['scenario']}:** {x['reason']}" for x in report["unverified"]]
    markdown += ["", "Do not interpret passing mock/unit tests or a PostgreSQL-only"
                 " fault as proof of full Canvas Rails/LTI parity.",
                 "Only synthetic data and one-shot disposable Docker resources were used."]
    (out_dir / "parity-comparison.md").write_text("\n".join(markdown)+"\n",encoding="utf8")
    print("QA_PARITY_COMPARE", [(x["status"], x["comparedChecks"]) for x in rows])
    print("QA_REAL_CHECKS_COMPARED",report["realChecksCompared"])
    print("QA_FULL_FUNCTIONAL_PARITY_PROVEN",False)
    return 0 if report["allAvailableComparedChecksPass"] else 2

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print("QA_PARITY_COMPARE_ERROR",type(e).__name__,flush=True)
        sys.exit(3)
