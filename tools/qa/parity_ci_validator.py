#!/usr/bin/env python3
"""Reproducible, non-destructive CI comparison over pinned source revisions."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys

QA = Path("/mnt/d/Documentos/MDL/Informatico/Plugin-Feedback-Parity-QA")
ENGLISH = Path("/home/jaime/proyectos/Plugin-Feedback-Canvas")
ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
NODE_BIN = "/home/jaime/.nvm/versions/node/v22.23.2/bin"

def git(repo):
    result = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"],
                            text=True, capture_output=True, timeout=20)
    if result.returncode:
        raise RuntimeError("Cannot determine source Git commit")
    return result.stdout.strip()

def launch(name, args, source, env, duration=420):
    try:
        p = subprocess.run(args, cwd=source, env=env, text=True,
                           capture_output=True, timeout=duration)
        out = ANSI.sub("", p.stdout + "\n" + p.stderr)
        if p.returncode:
            detail = QA / "reports" / ("qa-ci-failure-" + name + ".txt")
            detail.write_text(out[-65000:], encoding="utf8")
        successes = [line.strip() for line in out.splitlines()
                     if re.search(r"Test Files|Tests\s+|Ran \d+ tests|^OK$|^FAILED", line)]
        # Retain bounded summaries, not full test output and no credentials.
        print("QA_CI", name, "exit", p.returncode,
              "summary", " | ".join(successes[-4:])[-360:],flush=True)
        return {"status":"PASS" if p.returncode==0 else "FAIL",
                "returnCode":p.returncode, "summary":successes[-4:]}
    except subprocess.TimeoutExpired:
        print("QA_CI",name,"TIMEOUT",duration,flush=True)
        return {"status":"TIMEOUT","timeoutSeconds":duration}

def main():
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument("--source",required=True)
    a.add_argument("--label",choices=["english","spanish-main"],required=True)
    args=a.parse_args()
    repo=Path(args.source).resolve(strict=True)
    base=QA.resolve(strict=True)
    if repo != ENGLISH and not repo.is_relative_to(base):
        raise RuntimeError("Source outside approved QA workspace")
    if not (repo/"package-lock.json").is_file():
        raise RuntimeError("Missing immutable dependency lockfile")
    out_dir=base/"reports"
    out_dir.mkdir(parents=True,exist_ok=True)
    # Permission-sensitive tests (0600 files, 0777 gem-cache repair) require
    # POSIX semantics. D: is NTFS under WSL, so only temporary fixtures go to
    # RAM-backed tmpfs; dependencies, npm cache and all evidence remain on D.
    ram_temp=Path('/dev/shm/feedback-parity-ci')/args.label
    ram_temp.mkdir(parents=True, exist_ok=True, mode=0o700)
    ram_temp.chmod(0o700)
    env=os.environ.copy()
    env.update({"CI":"true", "FORCE_COLOR":"1", "PATH":NODE_BIN+":"+env.get("PATH",""),
                "npm_config_cache":str(base/".npm-cache"),
                "TMPDIR":str(ram_temp), "PIP_DISABLE_PIP_VERSION_CHECK":"1"})
    # Historical Python unit tests expect a disposable Canvas directory to exist
    # before they test ownership rejection. Keep the empty fixture entirely on D;
    # no live Canvas clone, database or credentials are copied into it.
    empty_fixture=base/"qa-feedback-20261110"/"clean"/"canvas-lms-master"
    empty_fixture.mkdir(parents=True, exist_ok=True)
    py_env={**env, "HOME":str(base),
            "DOCKER_HOST":"unix:///run/user/1000/docker.sock"}
    results={}
    results["vitest"]=launch("vitest",["npm","test"],repo,env,duration=420)
    results["pythonQA"]=launch("pythonQA",
                              [sys.executable,"-m","unittest","discover",
                               "-s","tools/qa/tests","-p","test_*.py","-q"],
                              repo,py_env,duration=90)
    results["pythonDiagnostics"]=launch("pythonDiagnostics",
          [sys.executable,"-m","unittest","discover",
           "-s","tools/diagnostics/tests","-p","test_*.py","-q"],
          repo,py_env,duration=90)
    results["lint"]=launch("lint",["npm","run","lint"],repo,env,duration=210)
    results["build"]=launch("build",["npm","run","build"],repo,env,duration=260)
    status="PASS" if all(x["status"]=="PASS" for x in results.values()) else "PARTIAL"
    report={"schema":"qa-parity-ci-v1",
            "generatedAtUtc":datetime.now(timezone.utc).isoformat(),
            "sourceCommit":git(repo),"label":args.label,
            "status":status,"validations":results}
    dest=out_dir/(args.label+"-ci.json")
    dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    dest.chmod(0o600)
    print("QA_CI_RESULT",args.label,status,"evidence",dest,flush=True)
    return 0 if status=="PASS" else 2

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as e:
        print("QA_CI_BLOCKED",type(e).__name__,flush=True)
        sys.exit(3)
