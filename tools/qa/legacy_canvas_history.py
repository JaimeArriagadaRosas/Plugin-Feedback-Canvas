#!/usr/bin/env python3
"""Read-only Canvas migration history audit. Never upgrades Canvas or mutates Docker volumes."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone

QA_ROOT = Path.home() / "qa-feedback-20261110"
QA_CANVAS = QA_ROOT / "clean/canvas-lms-master"
CONTAINER = "qa-feedback-20261110-postgres-1"
PROJECT = "qa-feedback-20261110"
SPECIAL_TEST_ONLY = "99999999999999999999_ensure_test_db_empty.rb"

def classify(source_versions, applied_versions, test_only_versions=frozenset()):
    expected = set(source_versions) - set(test_only_versions)
    applied = set(applied_versions)
    if len(applied_versions) != len(applied):
        return {"status":"blocked", "code":"CANVAS-DB-HISTORY-DUPLICATE",
                "pendingCount":None, "unknownCount":None}
    unknown = sorted(applied - expected - set(test_only_versions))
    pending = sorted(expected - applied)
    status = "blocked" if unknown else "review_required" if pending else "compatible"
    return {
        "status":status,
        "code":"CANVAS-DB-HISTORY-UNKNOWN" if unknown else
               "CANVAS-DB-HISTORY-PENDING" if pending else "CANVAS-DB-HISTORY-OK",
        "pendingCount":len(pending), "unknownCount":len(unknown),
        "pendingSample":pending[:8], "unknownSample":unknown[:8],
        "excludedTestOnlyCount":len(test_only_versions)
    }

def run(cmd, stdin=None):
    try:
        result=subprocess.run(cmd,input=stdin,capture_output=True,text=True,
                              timeout=25,check=False)
        return result
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Bounded read-only QA inspection timed out") from exc

def validate_owner():
    for flag in ("QA_ALLOW_CANVAS_LEGACY_AUDIT","PLUGIN_TEST_MODE","PLUGIN_QA_NO_BROWSER"):
        if os.environ.get(flag) != "true":
            raise RuntimeError("Explicit QA opt-in required")
    if not QA_CANVAS.resolve(strict=True).is_relative_to(QA_ROOT.resolve(strict=True)):
        raise RuntimeError("Refusing Canvas source outside isolated QA root")
    p=run(["docker","inspect",CONTAINER,"--format","{{json .}}"])
    if p.returncode != 0: raise RuntimeError("QA PostgreSQL container unavailable")
    obj=json.loads(p.stdout)
    labels=obj.get("Config",{}).get("Labels") or {}
    if (labels.get("com.docker.compose.project")!=PROJECT or
        labels.get("com.docker.compose.service")!="postgres" or
        Path(labels.get("com.docker.compose.project.working_dir") or "/").resolve()!=QA_CANVAS.resolve() or
        obj.get("State",{}).get("Running") is not True):
        raise RuntimeError("PostgreSQL Docker labels or working folder do not match QA")
    return True

def read_versions():
    sql = """BEGIN TRANSACTION READ ONLY;
SELECT current_database();
SELECT version FROM public.schema_migrations ORDER BY version;
ROLLBACK;
"""
    proc=run(["docker","exec","-i","-e",
              "PGOPTIONS=-c default_transaction_read_only=on",
              CONTAINER,"psql","-X","-q","-A","-t",
              "-v","ON_ERROR_STOP=1","-U","postgres",
              "-d","canvas_development"],stdin=sql)
    if proc.returncode:
        raise RuntimeError("Cannot read migration versions from QA")
    lines=[value.strip() for value in proc.stdout.splitlines() if value.strip()]
    if not lines or lines[0]!="canvas_development":
        raise RuntimeError("Database identity cannot be proven")
    versions=lines[1:]
    if not all(re.fullmatch(r"[0-9]{8,22}",x) for x in versions):
        raise RuntimeError("Unexpected version format")
    return versions

def source_versions(source):
    files=list((source/"db/migrate").glob("*.rb"))
    if not files: raise RuntimeError("Cannot inspect Canvas migration files")
    versions={}
    special=set()
    for file in files:
        match=re.fullmatch(r"(\d{8,22})_.+\.rb",file.name)
        if not match:raise RuntimeError("Unexpected Canvas migration filename")
        version=match.group(1)
        if version in versions:raise RuntimeError("Duplicate Canvas migration filenames")
        versions[version]=file.name
        if file.name==SPECIAL_TEST_ONLY and "Rails.env.test?" in file.read_text(encoding="utf8"):
            special.add(version)
    return versions, special

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report",required=True)
    options=parser.parse_args()
    output=Path(options.report).resolve()
    if not output.is_relative_to((QA_ROOT/"artifacts").resolve()):
        raise RuntimeError("Reports must remain under QA artifacts")
    validate_owner()
    source, test_only=source_versions(QA_CANVAS)
    applied=read_versions()
    actual=classify(source,applied,test_only)
    # Controlled classifier fixtures. They do not edit or upgrade Canvas.
    ordered=sorted(set(applied)-test_only)
    hypothetical_prior=ordered[:-3]
    simulations={
        "older_db_versions":classify(source,hypothetical_prior,test_only),
        "unknown_future_version":classify(source,applied+["88888888888888888888"],test_only),
        "complete_current_db":actual,
    }
    report={
        "timestamp":datetime.now(timezone.utc).isoformat(),
        "scope":"readonly_canvas_qa",
        "qaProject":PROJECT,
        "canvasSourceMigrationFiles":len(source),
        "appliedVersionCount":len(applied),
        "current":actual,
        "controlledClassifierFixtures":simulations,
        "mysqlOrProductionDatabasesTouched":False,
        "actualCanvasUpgradePerformed":False,
        "warnings":[
            "Pending migrations must be reviewed; do not run official upgrade on professor data automatically.",
            "An older version of code does not imply database migration safety.",
            "Controlled fixtures simulate version history only, not a full Canvas upgrade."
        ]
    }
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    output.chmod(0o600)
    print("QA_CANVAS_HISTORY="+json.dumps({
        "current":actual["status"],
        "currentCode":actual["code"],
        "pending":actual["pendingCount"],
        "unknown":actual["unknownCount"],
        "oldFixture":simulations["older_db_versions"]["code"],
        "unknownFixture":simulations["unknown_future_version"]["code"],
    }))
    print("QA_CANVAS_HISTORY_REPORT",output)
    return 0 if (actual["status"]=="compatible" and
                 simulations["older_db_versions"]["status"]=="review_required" and
                 simulations["unknown_future_version"]["status"]=="blocked") else 1

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as error:
        print("QA Canvas history safely blocked:",str(error),file=sys.stderr)
        sys.exit(3)
