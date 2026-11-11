#!/usr/bin/env python3
"""Fail-closed real-shard prerequisite probe; does not create, migrate, or modify shards."""
import argparse
import json
from pathlib import Path
import re
import sys
from datetime import datetime, timezone
from legacy_canvas_history import validate_owner, run, CONTAINER, QA_ROOT

GLOBAL_ID=100000000000001
GLOBAL_ID_MULTIPLIER=10**13

def classify_shards(shards,global_id=GLOBAL_ID):
    observed=set(shards)
    expected_shard=global_id//GLOBAL_ID_MULTIPLIER
    local=global_id%GLOBAL_ID_MULTIPLIER
    return {
        "shardCount":len(observed),
        "requiredMultipleShards":True,
        "multiShardEnvironmentAvailable":len(observed)>1,
        "suspectedGlobalShardSegment":expected_shard,
        "suspectedLocalSegment":local,
        "suspectedShardRegistered":expected_shard in observed,
        "scenarioStatus":"READY_FOR_MANUAL_E2E" if len(observed)>1 and expected_shard in observed else "SKIPPED",
        "note":"A shard number decoded from a global ID is only a hypothesis until Rails shard resolution and login are observed."
    }

def read_shards():
    sql="""BEGIN TRANSACTION READ ONLY;
SELECT current_database();
SELECT id FROM public.switchman_shards ORDER BY id;
ROLLBACK;
"""
    result=run(["docker","exec","-i","-e",
                "PGOPTIONS=-c default_transaction_read_only=on",
                CONTAINER,"psql","-X","-q","-A","-t",
                "-v","ON_ERROR_STOP=1","-U","postgres","-d","canvas_development"],stdin=sql)
    if result.returncode:
        raise RuntimeError("Cannot read QA shards safely")
    items=[line.strip() for line in result.stdout.splitlines() if line.strip()]
    if not items or items[0]!="canvas_development":
        raise RuntimeError("The expected QA database identity was not proved")
    values=items[1:]
    if not all(re.fullmatch(r"[1-9][0-9]{0,9}",item) for item in values):
        raise RuntimeError("Invalid shard identifiers")
    return [int(value) for value in values]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report",required=True)
    args=parser.parse_args()
    location=Path(args.report).resolve()
    if not location.is_relative_to((QA_ROOT/"artifacts").resolve()):
        raise RuntimeError("QA shard report path not authorized")
    validate_owner()
    numbers=read_shards()
    report={
        "timestamp":datetime.now(timezone.utc).isoformat(),
        "mode":"readonly_real_qa_shard_prerequisites",
        "result":classify_shards(numbers),
        "databaseModified":False,
        "fullMultishardLoginPerformed":False
    }
    location.parent.mkdir(parents=True,exist_ok=True)
    location.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    location.chmod(0o600)
    print("QA_REAL_SHARD_PREREQ="+json.dumps(report["result"]))
    return 0

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as error:
        print("QA shard probe safely blocked:",str(error),file=sys.stderr)
        sys.exit(3)
