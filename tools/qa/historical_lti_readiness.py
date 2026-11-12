#!/usr/bin/env python3
"""Read-only assessment of historical Canvas LTI registrations against QA plugin.

Never modifies LTI records, creates clients, starts apps, or performs a browser launch.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

QA=Path.home()/"qa-feedback-20261110/artifacts"
HIST=QA/"historical-compat"
KEYS=("august-canvas-db","october-canvas-db","october-alternate-db")

def classify(name,record):
    if not isinstance(record,dict):
        return {"source":name,"status":"NOT_RUN","launchVerified":False}
    db=record.get("result") or {}
    if db.get("cleanupConfirmed") is not True or db.get("originalModified") is not False:
        return {"source":name,"status":"FAIL","launchVerified":False}
    if db.get("status")=="BLOCKED" and (
        any(value is False for value in (db.get("catalog") or {}).values())
    ):
        return {"source":name,"status":"SCHEMA_BLOCKED","launchVerified":False}
    lti=db.get("ltiMetadata") or {}
    if lti.get("status") not in ("CONFIG_CANDIDATE","REGISTRATION_REVIEW"):
        return {"source":name,"status":"NOT_VERIFIED","launchVerified":False}
    return {"source":name,"status":lti["status"],"launchVerified":False,
            "historicalTools":lti.get("tools"),"publicTools":lti.get("publicTools"),
            "qaClientRegistrationCount":lti.get("toolsMatchingCurrentQaClient"),
            "qaEndpointRegistrationCount":lti.get("toolsForLocalQaBackend")}

def backend_http_probe():
    if os.environ.get("QA_ALLOW_HISTORICAL_LTI_READONLY")!="true" or (
        os.environ.get("PLUGIN_TEST_MODE")!="true" or
        os.environ.get("PLUGIN_QA_NO_BROWSER")!="true"
    ):
        raise RuntimeError("Explicit read-only QA opt-in and no-browser flags required")
    try:
        # A simple HTTPS request, not an LTI launch. Network access is local only.
        request=Request("https://localhost:3000/health",method="GET")
        import ssl
        ctx=ssl._create_unverified_context()  # QA localhost certificate; no remote hostname.
        with urlopen(request,timeout=2,context=ctx) as reply:
            return reply.status in (200,204)
    except (URLError,HTTPError,TimeoutError,OSError):
        return False

def build(read_report,backend_ready):
    cases=[classify(name,read_report(name)) for name in KEYS]
    return {
        "timestamp":datetime.now(timezone.utc).isoformat(),
        "mode":"readonly_historical_lti_registration_preflight",
        "backendHttpsLocalHealthReachable":bool(backend_ready),
        "actualLtiLaunchVerified":False,
        "allToolAndClientRegistrationsReady":all(
            c["status"]=="CONFIG_CANDIDATE" for c in cases[:2]),
        "status":"PREREQUISITE_REVIEW",
        "comparisons":cases,
        "notes":[
            "The QA .env client_id may be stale; a mismatch alone does not prove the LTI protocol is broken.",
            "A public Canvas tool and a running backend are not proof of a complete OIDC + iframe launch.",
            "Registration and deployment must be verified and, when necessary, created ONLY inside disposable Canvas databases.",
            "No changes made to client IDs, developer keys, LTI settings, Canvas or plugin databases."
        ]
    }

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report",required=True)
    args=parser.parse_args()
    output=Path(args.report).resolve()
    if not output.is_relative_to(QA.resolve()):
        raise RuntimeError("Read-only report must be stored under isolated QA artifacts.")
    if not HIST.is_dir():raise RuntimeError("Historical QA artifacts unavailable.")
    online=backend_http_probe()
    def read(name):
        file=HIST/(name+"-lti-readonly-20261111.json")
        if not file.is_file():return None
        return json.loads(file.read_text(encoding="utf8"))
    result=build(read,online)
    output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    output.chmod(0o600)
    print("QA_HISTORICAL_LTI_READINESS",
          [c["status"] for c in result["comparisons"]],
          "BACKEND_UP",result["backendHttpsLocalHealthReachable"],
          "LAUNCH_VERIFIED",result["actualLtiLaunchVerified"])
    print("QA_HISTORICAL_LTI_REPORT",output)
    return 0 if all(c["status"] not in ("NOT_RUN","FAIL") for c in result["comparisons"]) else 2

if __name__=="__main__":
    try:sys.exit(main())
    except (RuntimeError,OSError,ValueError) as exc:
        print("QA_HISTORICAL_LTI_BLOCKED",type(exc).__name__,file=sys.stderr)
        sys.exit(3)
