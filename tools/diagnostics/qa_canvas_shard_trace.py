#!/usr/bin/env python3
"""Read-only Rails shard/account trace in the verified disposable QA Canvas web container."""
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

SOURCE=Path(__file__).with_suffix(".rb")
DEFAULT_WEB="qa-feedback-20261110-web-1"
DEFAULT_DIR=Path.home()/"qa-feedback-20261110/clean/canvas-lms-master"

def verify(container, project, canvas_dir):
    if os.getenv("QA_ALLOW_SHARD_TRACE") != "true":
        raise RuntimeError("QA_ALLOW_SHARD_TRACE=true required; do not run in production")
    if not re.fullmatch(r"qa-[a-z0-9-]{4,64}", project):
        raise RuntimeError("The project must be isolated and named qa-*")
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{2,126}", container):
        raise RuntimeError("Invalid QA web container")
    actual=Path(canvas_dir).resolve(strict=True)
    if "/qa-" not in str(actual):
        raise RuntimeError("Refusing to inspect non-QA Canvas directory")
    p=subprocess.run(["docker","inspect",container,"--format","{{json .}}"],
                     capture_output=True,text=True,timeout=20,check=False)
    if p.returncode: raise RuntimeError("QA Canvas web container unavailable")
    info=json.loads(p.stdout)
    labels=info.get("Config",{}).get("Labels") or {}
    if (labels.get("com.docker.compose.project")!=project
            or labels.get("com.docker.compose.service")!="web"
            or Path(labels.get("com.docker.compose.project.working_dir") or "/").resolve()!=actual
            or not info.get("State",{}).get("Running")):
        raise RuntimeError("The web container is not a running service owned by this QA Canvas")
    return True

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container",default=DEFAULT_WEB)
    parser.add_argument("--project",default="qa-feedback-20261110")
    parser.add_argument("--qa-canvas-dir",default=str(DEFAULT_DIR))
    parser.add_argument("--report",required=True)
    args=parser.parse_args()
    verify(args.container,args.project,args.qa_canvas_dir)
    result=subprocess.run(["docker","exec","-e","QA_SHARD_TARGET_ID=100000000000001",
                           args.container,"bundle","exec","rails","runner","-e","development",
                           SOURCE.read_text()],capture_output=True,text=True,timeout=180,check=False)
    if result.returncode:
        raise RuntimeError("Rails introspection failed (details retained only in transient QA logs)")
    markers=[line.split("QA_SHARD_TRACE=",1)[1] for line in result.stdout.splitlines()
             if "QA_SHARD_TRACE=" in line]
    if len(markers)!=1:raise RuntimeError("QA_SHARD_TRACE marker unavailable")
    data=json.loads(markers[0])
    if data.get("shardCount",0)<1:
        raise RuntimeError("No shards detected; cannot trace")
    report={
        "qaProject":args.project,
        "mode":"Rails runner read-only",
        "targetGlobalId":"redacted",
        "trace":data,
        "interpretation":("A non-resolvable global ID on this one-shard lab does not establish "
                          "whether the professor has stale containers or a production sharding defect.")
    }
    path=Path(args.report).resolve()
    qa_root=Path.home()/"qa-feedback-20261110"
    if not str(path).startswith(str(qa_root)+os.sep):
        raise RuntimeError("Report outside the QA artifacts directory")
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,indent=2)+"\n")
    path.chmod(0o600)
    print("QA_SHARD_TRACE_SUMMARY",json.dumps(data))
    print("QA_SHARD_TRACE_REPORT",str(path))
    return 0

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as error:
        print("QA shard trace blocked:",str(error),file=sys.stderr)
        sys.exit(3)
