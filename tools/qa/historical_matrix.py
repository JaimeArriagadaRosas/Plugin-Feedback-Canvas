#!/usr/bin/env python3
"""Reconcile historical QA evidence. A code build and database read are not a login E2E."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from datetime import datetime, timezone

QA_ROOT=Path.home()/"qa-feedback-20261110/artifacts/historical-compat"
CODES=("august-main","october-validation","october-lint","october-original")
DATABASES=("august-canvas-db","october-canvas-db","october-alternate-db")

def result_for(root,name):
    path=root/name
    if not path.is_file():return None
    try:return json.loads(path.read_text(encoding="utf8")).get("result")
    except (OSError,ValueError,AttributeError):return None

def classified_syntax(name,record):
    if record is None:
        return {"scenario":"syntax_"+name,"status":"NOT_RUN"}
    if record.get("status")=="PASS" and record.get("stage")=="syntax" and record.get("filesChecked",0)>0 and not record.get("syntaxFailures"):
        return {"scenario":"syntax_"+name,"status":"PASS",
                "filesChecked":record["filesChecked"],"kind":"readonly_git_archive_node_check"}
    return {"scenario":"syntax_"+name,"status":"FAIL",
            "reason":"Historic source syntax inspection incomplete"}


def classified_build(name,record):
    if record is None:return {"scenario":"code_"+name,"status":"NOT_RUN"}
    if record.get("status")=="PASS" and record.get("stage")=="build":
        return {"scenario":"code_"+name,"status":"PASS","kind":"historical_source_build",
                "dependencies":record.get("dependencyMethod","unknown")}
    return {"scenario":"code_"+name,"status":"BLOCKED","stage":record.get("stage","unknown"),
            "reason":record.get("reason","Build failed in QA snapshot")}

def classified_db(name,record):
    if record is None:return {"scenario":"database_"+name,"status":"NOT_RUN"}
    if record.get("cleanupConfirmed") is not True:
        return {"scenario":"database_"+name,"status":"FAIL",
                "reason":"Disposable PostgreSQL cleanup not confirmed"}
    catalog=record.get("catalog") or {}
    if record.get("status") in ("PASS","REVIEW") and all(catalog.values()):
        return {"scenario":"database_"+name,"status":"PASS" if record["status"]=="PASS" else "REVIEW",
                "kind":"read_only_historical_postgres_clone",
                "counts":record.get("counts"),"integrity":record.get("integrity",{})}
    if record.get("status")=="BLOCKED":
        return {"scenario":"database_"+name,"status":"SAFELY_BLOCKED",
                "kind":"incomplete_historical_canvas_schema",
                "schemaCatalog":catalog,"reason":record.get("reason")}
    return {"scenario":"database_"+name,"status":"FAIL",
            "reason":record.get("reason","Unknown QA volume outcome")}

def consolidate(root):
    cases=[classified_syntax(name,result_for(root,name+"-syntax.json")) for name in CODES]
    cases += [classified_build(name,result_for(root,name+"-build.json")) for name in CODES]
    cases += [classified_db(name,result_for(root,name+"-integrity.json")) for name in DATABASES]
    diagnostics=[x for x in cases if x["status"]=="PASS"]
    blockers=[x for x in cases if x["status"]=="SAFELY_BLOCKED"]
    pending=[x for x in cases if x["status"] in ("NOT_RUN","BLOCKED","REVIEW","FAIL")]
    return {
        "date":datetime.now(timezone.utc).isoformat(),
        "project":"Plugin-Feedback-Canvas-feedback-cualitativo",
        "branch":"main",
        "menuModified":False,
        "historicalReposModified":False,
        "historicalDockerVolumesModified":False,
        "testKind":"real_historical_builds_plus_real_readonly_database_copies",
        "sourceAndDbCrossVersionLoginE2E":False,
        "rootCauseOfProfessorLoginFkConfirmed":False,
        "multiShardEndToEndAvailable":False,
        "scenarios":cases,
        "verified":len(diagnostics),
        "safeBlockers":len(blockers),
        "incomplete":len(pending),
        "limitations":[
            "Compilation is not proof of historical runtime compatibility.",
            "Read-only PostgreSQL diagnostics are not a Rails authentication E2E.",
            "Only actual Canvas/Switchman multi-shard environments can validate cross-shard login.",
            "No historical database was migrated, repaired, or edited."
        ]
    }

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    target=Path(args.output).resolve()
    if not target.is_relative_to(QA_ROOT.resolve()):
        raise RuntimeError("Report destination outside QA artifacts")
    summary=consolidate(QA_ROOT)
    target.write_text(json.dumps(summary,indent=2,ensure_ascii=False)+"\n")
    target.chmod(0o600)
    print("QA_HISTORICAL_MATRIX verified",summary["verified"],
          "safe_blockers",summary["safeBlockers"],
          "incomplete",summary["incomplete"],
          "cross_login_e2e",summary["sourceAndDbCrossVersionLoginE2E"])
    print("QA_HISTORICAL_MATRIX_REPORT",target)
    return 0 if summary["incomplete"]==0 else 2

if __name__=="__main__":
    try:raise SystemExit(main())
    except (RuntimeError,OSError,ValueError) as exc:
        print("QA_HISTORICAL_MATRIX_BLOCKED",type(exc).__name__)
        raise SystemExit(3)
