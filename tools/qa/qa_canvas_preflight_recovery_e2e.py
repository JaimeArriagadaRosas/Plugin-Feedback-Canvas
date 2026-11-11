#!/usr/bin/env python3
"""Real disposable PostgreSQL interruption/resume + Canvas preflight E2E.

This checks Docker/SQL state transitions, not a complete Rails installation.
Only the newly created qa-preflight-* Compose project can be started/stopped.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[2]
QA=Path.home()/"qa-feedback-20261110"/"artifacts"
PROBE=Path(__file__).with_name("canvas_preflight_probe.mjs")
VALID_PROJECT=re.compile(r"qa-preflight-[a-f0-9]{12}")

def authorize():
    for key in ("QA_ALLOW_CANVAS_PREFLIGHT_REAL_E2E","PLUGIN_TEST_MODE",
                "PLUGIN_QA_NO_BROWSER"):
        if os.getenv(key)!="true":
            raise RuntimeError("Explicit one-shot QA authorization required")
    if ROOT.resolve()!=(Path.home()/"proyectos/Plugin-Feedback-Canvas-feedback-cualitativo").resolve():
        raise RuntimeError("Only unified plugin clone authorized")
    if not QA.is_dir() or QA.is_symlink():
        raise RuntimeError("Disposable QA root unavailable")

def run(cmd,*,cwd=None,env=None,stdin=None,timeout=45):
    try:
        return subprocess.run(cmd,input=stdin,capture_output=True,text=True,
                              check=False,cwd=cwd or ROOT,env=env or os.environ,
                              timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("A bounded disposable QA command timed out") from exc

def require(value,message):
    if not value:raise RuntimeError(message)

def json_probe(folder):
    result=run(["node",str(PROBE),str(folder)],timeout=25)
    lines=[x.partition("QA_CANVAS_PREFLIGHT_STATE=")[2] for x in result.stdout.splitlines()
           if x.startswith("QA_CANVAS_PREFLIGHT_STATE=")]
    require(result.returncode==0 and len(lines)==1,"QA preflight probe did not run safely")
    item=json.loads(lines[0])
    require(item.get("state") in ("ready","stopped","missing","schema_incomplete",
                                 "identity_conflict","unavailable"),"Unexpected probe status")
    return item["state"]

def compose_file(project):
    require(VALID_PROJECT.fullmatch(project),"Invalid disposable project")
    return """services:
  postgres:
    image: postgres:15-alpine
    restart: "no"
    environment:
      POSTGRES_DB: canvas_development
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: qa-disposable-secret
    volumes:
      - canvas_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d canvas_development"]
      interval: 2s
      timeout: 2s
      retries: 30
volumes:
  canvas_postgres_data:
"""

def validated_owner(container,project):
    require(VALID_PROJECT.fullmatch(project),"Invalid owner name")
    info=run(["docker","inspect",container,"--format","{{json .}}"],timeout=20)
    require(info.returncode==0,"Disposable owner inspection unavailable")
    obj=json.loads(info.stdout)
    labels=obj.get("Config",{}).get("Labels") or {}
    require(labels.get("com.docker.compose.project")==project and
            labels.get("com.docker.compose.service")=="postgres",
            "Refusing Docker command on unexpected owner")

def sql(container,project,query):
    validated_owner(container,project)
    return run(["docker","exec","-i",container,"psql","-X","-q","-A","-t",
               "-v","ON_ERROR_STOP=1","-U","postgres","-d","canvas_development"],
               stdin=query,timeout=35)

def scenario(folder,project):
    details={"scope":"disposable_docker_postgres_only",
             "fullCanvasInstallationCertified":False,
             "actualRailsMigrationExecuted":False,
             "stages":[]}
    env={**os.environ,"COMPOSE_PROJECT_NAME":project}
    target=folder/"compose.yml"
    target.write_text(compose_file(project),encoding="utf8")
    args=["docker","compose","-p",project,"-f",str(target)]
    def dcompose(*cmd,timeout=55):
        return run([*args,*cmd],env=env,timeout=timeout)
    def step(name,expected):
        value=json_probe(folder)
        details["stages"].append({"stage":name,"expected":expected,"observed":value,
                                  "passed":value==expected})
        require(value==expected,f"Preflight state mismatch at {name}")
    container=project+"-postgres-1"
    active=False
    cleaned=False
    try:
        step("before_start","missing")
        active=True
        started=dcompose("up","-d","--wait",timeout=115)
        require(started.returncode==0,"Disposable Docker PostgreSQL failed to initialize")
        validated_owner(container,project)
        step("schema_initially_incomplete","schema_incomplete")
        setup=sql(container,project,"""BEGIN;
CREATE TABLE public.accounts (id bigint PRIMARY KEY);
CREATE TABLE public.terms_of_services (id bigint PRIMARY KEY, account_id bigint REFERENCES public.accounts(id));
CREATE TABLE public.switchman_shards (id bigint PRIMARY KEY);
CREATE TABLE public.schema_migrations (version varchar(32) PRIMARY KEY);
INSERT INTO public.accounts(id) VALUES(1);
COMMIT;""")
        require(setup.returncode==0,"Disposable schema bootstrap failed")
        step("schema_initialized","ready")
        result=dcompose("stop","postgres")
        require(result.returncode==0,"Could not stop disposable PostgreSQL")
        validated_owner(container,project)
        step("postgres_intentionally_stopped","stopped")
        # A read-only preflight MUST leave the service stopped.
        snapshot=run(["docker","inspect",container,"--format","{{.State.Running}}"])
        require(snapshot.returncode==0 and snapshot.stdout.strip()=="false",
                "Preflight unexpectedly restarted stopped DB")
        restored=dcompose("start","postgres")
        require(restored.returncode==0,"Could not resume disposable PostgreSQL")
        deadline=time.monotonic()+40
        while time.monotonic()<deadline:
            if sql(container,project,"SELECT 1;").returncode==0:break
            time.sleep(1)
        else:raise RuntimeError("Disposable PostgreSQL not ready after restart")
        step("postgres_resumed","ready")
        # PostgreSQL aborts a real DDL transaction after an execution error.
        failed=sql(container,project,"""BEGIN;
CREATE TABLE public.qa_interrupted_migration(id int PRIMARY KEY);
INSERT INTO public.qa_interrupted_migration(id) VALUES (1);
SELECT 1/0;
COMMIT;""")
        require(failed.returncode!=0,"The forced transactional interruption did not occur")
        table=sql(container,project,"SELECT to_regclass('public.qa_interrupted_migration') IS NULL;")
        require(table.returncode==0 and table.stdout.strip()=="t",
                "PostgreSQL persisted uncommitted migration changes")
        recovered=sql(container,project,"""BEGIN;
CREATE TABLE public.qa_interrupted_migration(id int PRIMARY KEY);
INSERT INTO public.qa_interrupted_migration(id) VALUES (1);
COMMIT;
SELECT count(*) FROM public.qa_interrupted_migration;""")
        require(recovered.returncode==0 and recovered.stdout.strip()=="1",
                "Resume of disposable transactional setup failed")
        step("transaction_rollback_and_reapply","ready")
        links=sql(container,project,"""BEGIN TRANSACTION READ ONLY;
SELECT COUNT(*) FROM public.accounts a LEFT JOIN public.terms_of_services t
ON t.account_id=a.id WHERE a.id=1;
ROLLBACK;""")
        require(links.returncode==0,"Read-only schema integrity verification failed")
        details["transactionRollbackProven"]=True
        details["recoveryAppliedOnlyToDisposableDatabase"]=True
        details["status"]="PASS_RECOVERED"
    except Exception as exc:
        details["status"]="FAIL"
        details["failureType"]=type(exc).__name__
        details["failureStage"]=details["stages"][-1]["stage"] if details["stages"] else "before_start"
    finally:
        if active:
            try:
                listed=dcompose("ps","-a","-q","postgres")
                ids=listed.stdout.split()
                if ids:
                    require(len(ids)==1,"Ambiguous disposable containers: cleanup blocked")
                    validated_owner(ids[0],project)
                cleaned=dcompose("down","-v",timeout=80).returncode==0
            except Exception:
                cleaned=False
        else:cleaned=True
        details["cleanupConfirmed"]=cleaned
        if not cleaned:details["status"]="FAIL"
    return details

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report",required=True)
    args=parser.parse_args()
    authorize()
    destination=Path(args.report).resolve()
    require(destination.suffix==".json" and destination.is_relative_to(QA.resolve()),
            "Report must be a JSON inside QA artifacts")
    owner="qa-preflight-"+secrets.token_hex(6)
    with tempfile.TemporaryDirectory(prefix=owner,dir=QA) as temporary:
        # Compose owner expects an exact stable directory name.
        # TemporaryDirectory adds unpredictable characters; use its resolved path
        # for Docker's working_dir label, while gateway requires exact basename.
        directory=Path(temporary)
        # Use temporary folder's randomized suffix in the QA project name.
        actual=directory.name
        require(re.fullmatch(r"qa-preflight-[a-f0-9]{12}[a-z0-9_]+",actual),
                "Invalid disposable folder")
        # The probe has a narrower allowlist; give it a stable nested alias.
        probe_dir=directory/owner
        probe_dir.mkdir()
        result=scenario(probe_dir,owner)
    report={"generatedAt":datetime.now(timezone.utc).isoformat(),
            "mode":"actual_docker_and_postgres_interruption_preflight",
            "historicDatabasesModified":False,"interactiveMenuModified":False,
            "result":result}
    destination.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    destination.chmod(0o600)
    print("QA_CANVAS_PREFLIGHT_RECOVERY",result["status"],"CLEAN",result["cleanupConfirmed"])
    print("QA_CANVAS_PREFLIGHT_REPORT",destination)
    return 0 if result["status"]=="PASS_RECOVERED" else 2

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as error:
        print("QA preflight safely blocked",type(error).__name__,file=sys.stderr)
        sys.exit(3)
