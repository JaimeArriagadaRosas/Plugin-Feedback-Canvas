#!/usr/bin/env python3
"""Strict evidence report for historical Canvas login and key-continuity experiments.

It does not start containers, execute migrations or repair user data.
"""
import argparse
import json
from pathlib import Path
from datetime import datetime,timezone
import subprocess
import sys

QA=Path.home()/"qa-feedback-20261110/artifacts"
HIST={
    "august":"historical_owner",
    "october":"historical_owner",
    "august-web-october-data":"mismatched_key",
    "october-web-august-data":"mismatched_key",
    "august-web-october-data-matched-key":"key_matches_data",
    "october-web-august-data-matched-key":"key_matches_data",
    "october-incomplete":"incomplete_schema"
}

def evaluate(name,record):
    if record is None:
        return {"pair":name,"status":"NOT_RUN"}
    data=record.get("result") or {}
    if data.get("cleanupConfirmed") is not True or data.get("originalResourcesModified") is not False:
        return {"pair":name,"status":"FAIL","reason":"Cleanup/immutability not confirmed"}
    expected=HIST[name]
    actual=data.get("status")
    if expected in ("historical_owner","key_matches_data"):
        ok=(actual=="PASS_HTTP" and data.get("httpStatus")==200 and
            data.get("headlessStatus")=="PASS" and
            data.get("browserChecks",0)>=7 and
            data.get("browserChecks")==data.get("browserPassCount"))
        if expected=="key_matches_data":
            ok=ok and data.get("keyCompatibility")=="matched_to_copied_database_owner"
        return {"pair":name,"status":"PASS" if ok else "NOT_VERIFIED",
                "headless":data.get("headlessStatus"),
                "http":data.get("httpStatus"),
                "postLogin":bool(ok),"fkSignatureObserved":data.get("fkSignatureMatch")}
    if expected=="mismatched_key":
        blocked=actual=="BLOCKED" and data.get("httpStatus")==500 and data.get("headlessStatus")=="NOT_RUN"
        return {"pair":name,"status":"REPRODUCED_GET_500" if blocked else "NOT_REPRODUCED",
                "http":data.get("httpStatus"),"postLogin":False}
    if expected=="incomplete_schema":
        catalog=data.get("schemaCatalog") or {}
        valid=actual=="SAFELY_BLOCKED" and data.get("headlessStatus")=="NOT_RUN_SCHEMA_BLOCKED" and (
            any(catalog.get(k) is False for k in ("accounts","terms","shards","migrations")))
        return {"pair":name,"status":"SAFELY_BLOCKED" if valid else "NOT_VERIFIED",
                "webStarted":False}
    raise ValueError("Unknown historical experiment category")

def professor_case(name,record):
    if record is None:return {"pair":name,"role":"professor","status":"NOT_RUN"}
    value=record.get("result") or {}
    ok=(value.get("cleanupConfirmed") is True and
        value.get("status")=="PASS_HTTP" and
        value.get("headlessStatus")=="PASS" and
        value.get("browserPassCount")==value.get("browserChecks") and
        value.get("browserChecks",0)>0 and
        value.get("fkObserved") is False and
        value.get("fkSignatureMatch") is False)
    return {"pair":name,"role":"professor",
            "status":"PASS_NO_FK" if ok else "NOT_VERIFIED",
            "checks":value.get("browserChecks",0),
            "fkObserved":value.get("fkObserved")}

def summarize(folder):
    cases=[]
    for pair in HIST:
        path=folder/("qa-historical-pair-"+pair+"-20261111.json")
        # The original August run is retained separately; its FK log evidence
        # was not measured and must not be implied.
        if pair=="august":
            validated=folder/"qa-historical-pair-august-20261111-v3.json"
            if validated.is_file():
                # The earlier August attempt was blocked by Docker --internal
                # port publishing. This explicitly selects the later successful
                # real run without concealing the earlier report.
                path=validated
        try:doc=json.loads(path.read_text()) if path.is_file() else None
        except ValueError:doc=None
        cases.append(evaluate(pair,doc))
    valid_samples=[item for item in cases if item["status"]=="PASS"]
    mismatched=[item for item in cases if item["status"]=="REPRODUCED_GET_500"]
    blockers=[item for item in cases if item["status"]=="SAFELY_BLOCKED"]
    complete=len(valid_samples)==4 and len(mismatched)==2 and len(blockers)==1
    professor=[]
    for pair in ("august","october"):
        path=folder/("qa-historical-pair-"+pair+"-professor-20261111.json")
        try:record=json.loads(path.read_text()) if path.is_file() else None
        except ValueError:record=None
        professor.append(professor_case(pair,record))
    return {
        "timestamp":datetime.now(timezone.utc).isoformat(),
        "sourceRepository":"Plugin-Feedback-Canvas-feedback-cualitativo",
        "branch":"main",
        "menuModified":False,
        "realHistoricalCanvasAppAndDatabasePaired":True,
        "totalExperiments":len(HIST),
        "passedHeadlessLogins":len(valid_samples),
        "naturalGet500MismatchCases":len(mismatched),
        "safeSchemaBlocks":len(blockers),
        "experimentalMatrixComplete":complete,
        "historicalDataModified":False,
        "crossVersionLtiConfirmed":False,
        "professorExactFkReproduced":False,
        "caveats":[
            "Both historical Canvas source repos use the same Canvas code SHA. The mismatches are configuration/data, not proven version-diff bugs.",
            "GET /login/canvas 500 without a POST and constraint signature is NOT the professor's login FK exception.",
            "The diagnosis uses isolated real historical PostgreSQL copies and headless browser login but does not establish production causality.",
            "One August baseline used browser evidence only; FK-specific Rails log inspection was not performed then.",
            "LTI across historical Canvas and latest Plugin Feedback requires a registered, reachable QA plugin endpoint."
        ],
        "cases":cases,
        "professorHeadlessCases":professor,
        "professorNegativeAttempts":sum(item["status"]=="PASS_NO_FK" for item in professor)
    }

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output",required=True)
    args=p.parse_args()
    output=Path(args.output).resolve()
    if not output.is_relative_to(QA.resolve()):
        raise RuntimeError("Historical report outside QA artifacts")
    report=summarize(QA)
    output.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
    output.chmod(0o600)
    print("QA_HPAIR_MATRIX",len(report["cases"]),"login_pairs",report["passedHeadlessLogins"],
          "get500_cases",report["naturalGet500MismatchCases"],
          "safe_blocks",report["safeSchemaBlocks"],
          "complete",report["experimentalMatrixComplete"])
    print("QA_HPAIR_MATRIX_REPORT",output)
    return 0 if report["experimentalMatrixComplete"] else 2

if __name__=="__main__":
    try:sys.exit(main())
    except (OSError,ValueError,RuntimeError) as error:
        print("QA_HPAIR_MATRIX_BLOCKED",type(error).__name__,file=sys.stderr)
        sys.exit(3)
