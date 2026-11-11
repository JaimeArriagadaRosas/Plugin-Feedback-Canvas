#!/usr/bin/env python3
"""Read-only Docker provenance and config drift comparison. No services are started or stopped."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone

def execute(*args):
    result=subprocess.run(["docker",*args],capture_output=True,text=True,timeout=20,check=False)
    return result.stdout.strip() if result.returncode==0 else ""

def service_candidates(project,service):
    ids=execute("ps","-a","-q",
                "--filter","label=com.docker.compose.project="+project,
                "--filter","label=com.docker.compose.service="+service)
    return ids.splitlines()

def service_state(project,service):
    items=service_candidates(project,service)
    if len(items)!=1:return None
    raw=execute("inspect",items[0],"--format","{{json .}}")
    try:data=json.loads(raw)
    except (ValueError,TypeError):return None
    labels=data.get("Config",{}).get("Labels") or {}
    mounts=data.get("Mounts") or []
    ports=(data.get("HostConfig",{}).get("PortBindings") or {})
    port_fingerprint=sorted((key,tuple(sorted(str(p.get("HostPort")) for p in (items or []))))
                            for key,items in ports.items())
    # Hash volume identity, never export mount source paths or container environment.
    volumes=sorted((m.get("Destination",""),hashlib.sha256(
        str(m.get("Name",m.get("Source",""))).encode()).hexdigest()[:12]) for m in mounts)
    return {
        "owner": labels.get("com.docker.compose.project"),
        "service":labels.get("com.docker.compose.service"),
        "workingDir":labels.get("com.docker.compose.project.working_dir"),
        "image":data.get("Config",{}).get("Image"),
        "running":bool(data.get("State",{}).get("Running")),
        "portFingerprint":port_fingerprint,
        "volumeIdentityHashes":volumes
    }

def discrepancies(expected,actual):
    if actual is None:return ["service_missing"]
    fields=["owner","service","workingDir","image","portFingerprint","volumeIdentityHashes"]
    return [field+"_mismatch" for field in fields if expected.get(field)!=actual.get(field)]

def env_keys(location):
    if not location.is_file():return None
    keys=set()
    for line in location.read_text(encoding="utf-8",errors="replace").splitlines():
        if line.startswith("#") or "=" not in line:continue
        key=line.split("=",1)[0].strip()
        if re.fullmatch(r"[A-Z][A-Z0-9_]{1,80}",key):keys.add(key)
    return keys

def simulations(baseline):
    cases=[
        ("unchanged_reboot",{} ,False),
        ("reused_old_project",{"owner":"qa-previous-project"},True),
        ("stale_working_directory",{"workingDir":"/tmp/qa-legacy-root"},True),
        ("outdated_image",{"image":"postgres:11"},True),
        ("stale_volume",{"volumeIdentityHashes":[("/var/lib/postgresql/data","obsolete")]},True),
        ("wrong_port_binding",{"portFingerprint":[("5432/tcp",("9999",))]},True),
        ("wrong_service",{"service":"web"},True),
    ]
    report=[]
    for label,changes,should_warn in cases:
        observation=copy.deepcopy(baseline)
        observation.update(changes)
        mismatches=discrepancies(baseline,observation)
        report.append({"scenario":label,"passed":bool(mismatches)==should_warn,
                       "detectedDrift":mismatches,"testKind":"synthetic_provenance_classifier"})
    return report

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--project",default="qa-feedback-20261110")
    ap.add_argument("--qa-canvas-dir",default=str(Path.home()/"qa-feedback-20261110/clean/canvas-lms-master"))
    ap.add_argument("--qa-plugin-dir",default=str(Path.home()/"qa-feedback-20261110/clean/Plugin-Feedback-Canvas"))
    ap.add_argument("--historical-project",default="canvas-lms-master")
    ap.add_argument("--historical-plugin-dir",default=str(Path.home()/"proyectos/Plugin-Feedback-Canvas-feedback-cualitativo"))
    ap.add_argument("--report",required=True)
    args=ap.parse_args()
    if os.getenv("QA_ALLOW_HISTORY_LAB")!="true" or not re.fullmatch(r"qa-[a-z0-9-]{4,64}",args.project):
        raise RuntimeError("Only explicit qa- history lab authorized")
    canvas_dir=Path(args.qa_canvas_dir).resolve(strict=True)
    if "/qa-" not in str(canvas_dir) or not (canvas_dir/"docker-compose.yml").is_file():
        raise RuntimeError("Expected QA Canvas directory")
    qa_db=service_state(args.project,"postgres")
    qa_web=service_state(args.project,"web")
    if not qa_db or not qa_web or qa_db["workingDir"]!=str(canvas_dir) or qa_web["workingDir"]!=str(canvas_dir):
        raise RuntimeError("QA Compose labels do not match the requested isolated workspace")
    old_candidate_counts={"postgres":len(service_candidates(args.historical_project,"postgres")),
                          "web":len(service_candidates(args.historical_project,"web"))}
    old_db=service_state(args.historical_project,"postgres")
    old_web=service_state(args.historical_project,"web")
    old_keys=env_keys(Path(args.historical_plugin_dir)/".env")
    qa_keys=env_keys(Path(args.qa_plugin_dir)/".env")
    scenarios=simulations(qa_db)
    report={
        "time":datetime.now(timezone.utc).isoformat(),
        "qaProject":args.project,
        "baselineServicesRunning":{"postgres":qa_db["running"],"web":qa_web["running"]},
        "historicalMetadataAvailable":{"postgres":old_db is not None,"web":old_web is not None},
        "historicalServiceCandidateCounts":old_candidate_counts,
        "historicalResolution":{"postgres":"ambiguous" if old_candidate_counts["postgres"]>1 else
                                ("missing" if old_candidate_counts["postgres"]==0 else "unique"),
                                "web":"ambiguous" if old_candidate_counts["web"]>1 else
                                ("missing" if old_candidate_counts["web"]==0 else "unique")},
        "historicalServicesRunning":{"postgres":old_db["running"] if old_db else None,
                                     "web":old_web["running"] if old_web else None},
        "metadataDifferences":{
            "postgres":(["service_ambiguous"] if old_candidate_counts["postgres"]>1 else discrepancies(qa_db,old_db)),
            "web":(["service_ambiguous"] if old_candidate_counts["web"]>1 else discrepancies(qa_web,old_web))
        },
        "envKeyCounts":{"qa":len(qa_keys) if qa_keys is not None else None,
                        "historical":len(old_keys) if old_keys is not None else None},
        "environmentKeysOnlyDifference":{
            "onlyQA": sorted(qa_keys-old_keys) if qa_keys is not None and old_keys is not None else None,
            "onlyHistorical": sorted(old_keys-qa_keys) if qa_keys is not None and old_keys is not None else None
        },
        "simulations":scenarios,
        "limitations":"Metadata comparison is observational; historical containers are not started, and differences do not prove the professor's error."
    }
    path=Path(args.report).resolve()
    qa_root=Path.home()/"qa-feedback-20261110"
    if not str(path).startswith(str(qa_root)+os.sep):
        raise RuntimeError("Report must remain in isolated QA directory")
    path.parent.mkdir(exist_ok=True,parents=True)
    path.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
    path.chmod(0o600)
    print("QA_PERSISTENCE_CLASSIFIER",sum(x["passed"] for x in scenarios),"/",len(scenarios))
    print("QA_HISTORICAL_METADATA_AVAILABLE",report["historicalMetadataAvailable"])
    if old_candidate_counts["postgres"]>1:
        print("[CANVAS-DOCKER-LEGACY-001] Multiple historical PostgreSQL containers share"
              " Compose project/service labels. No automatic selection or cleanup.")
    print("QA_HISTORICAL_SERVICES_RUNNING",report["historicalServicesRunning"])
    print("QA_PERSISTENCE_REPORT",str(path))
    return 0 if all(s["passed"] for s in scenarios) else 1

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as error:
        print("QA persistence matrix aborted:",str(error),file=sys.stderr)
        sys.exit(3)
