#!/usr/bin/env python3
"""Disposable PostgreSQL clone of isolated Canvas QA, with transaction-only history experiments.

No Canvas production databases, historical volumes, migrations, or credentials may be targeted.
The cloned database is created and dropped on the verified QA PostgreSQL container.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_CONTAINER = "qa-feedback-20261110-postgres-1"
DEFAULT_PROJECT = "qa-feedback-20261110"
SOURCE_DATABASE = "canvas_development"
PREFIX = "qa_canvas_history_"
FINGERPRINT = """SELECT md5(
coalesce((SELECT string_agg(id::text || ':' || coalesce(root_account_id::text,''),',' ORDER BY id) FROM public.accounts),'')
|| '/' || coalesce((SELECT string_agg(id::text || ':' || account_id::text,',' ORDER BY id) FROM public.terms_of_services),'')
|| '/' || coalesce((SELECT string_agg(id::text,',' ORDER BY id) FROM public.switchman_shards),'')
);"""

def run(args, *, input_data=None, timeout=120):
    try:
        return subprocess.run(args, input=input_data, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, check=False, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Command exceeded bounded timeout; cleanup will be attempted")

def docker(container, *args, input_data=None, timeout=120):
    return run(["docker", "exec", *(['-i'] if input_data is not None else []),
                container, *args], input_data=input_data, timeout=timeout)

def sql(container, database, statement):
    return docker(container, "psql", "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1",
                  "-U", "postgres", "-d", database,
                  input_data=statement.encode("utf-8"), timeout=30)

def decode(result):
    return result.stdout.decode("utf-8", errors="replace").strip()

def verified_target(container, project, qa_canvas_dir):
    if os.getenv("QA_ALLOW_HISTORY_LAB") != "true":
        raise RuntimeError("Set QA_ALLOW_HISTORY_LAB=true for isolated QA only")
    if not re.fullmatch(r"qa-[a-z0-9-]{4,64}", project):
        raise RuntimeError("Only named qa- Compose projects are allowed")
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{2,126}", container):
        raise RuntimeError("Invalid container name")
    real_dir = Path(qa_canvas_dir).resolve(strict=True)
    if "/qa-" not in str(real_dir) or not (real_dir / "docker-compose.yml").is_file():
        raise RuntimeError("Expected an existing isolated qa- Canvas directory")
    inspect = run(["docker", "inspect", container, "--format", "{{json .}}"])
    if inspect.returncode:
        raise RuntimeError("Container could not be inspected")
    obj = json.loads(decode(inspect))
    labels = obj.get("Config", {}).get("Labels") or {}
    if (labels.get("com.docker.compose.project") != project or
        labels.get("com.docker.compose.service") != "postgres" or
        Path(labels.get("com.docker.compose.project.working_dir") or "/").resolve() != real_dir or
        not obj.get("State", {}).get("Running")):
        raise RuntimeError("Docker labels/working directory do not match the authorized QA stack")
    response = sql(container, SOURCE_DATABASE,
                   "SELECT current_database(), pg_is_in_recovery();")
    if response.returncode or decode(response) != SOURCE_DATABASE + "|f":
        raise RuntimeError("Canvas QA database identity could not be verified")
    return True

def experiment(container, database, label, statement, *, success, marker=None, expected_output=None):
    query = "BEGIN;\nSET LOCAL statement_timeout = '8000ms';\n" + statement + "\nROLLBACK;\n"
    result = sql(container, database, query)
    stderr = result.stderr.decode("utf-8", errors="replace")
    output = decode(result)
    passed = (result.returncode == 0) if success else (result.returncode != 0)
    if marker:
        passed = passed and marker.lower() in stderr.lower()
    if expected_output is not None:
        passed = passed and output.splitlines()[-1:] == [str(expected_output)]
    # Deliberately do not export raw SQL errors, account IDs, or query contents.
    return {
        "scenario": label, "passed": bool(passed), "sqlOutcome": "accepted" if result.returncode == 0 else
        ("fk_rejected" if "foreign key" in stderr.lower() else
         "uniqueness_rejected" if "unique constraint" in stderr.lower() else "other_rejected"),
        "mode": "transaction_rolled_back"
    }

def run_matrix(container, database):
    scenarios = [
        ("clean_root_account", "SELECT count(*) FROM public.accounts WHERE id=1 AND root_account_id=0;",
         True, None, 1),
        ("prior_terms_removed", "DELETE FROM public.terms_of_services WHERE account_id=1;\n"
         "SELECT count(*) FROM public.terms_of_services WHERE account_id=1;", True, None, 0),
        ("stale_global_id_on_terms", "UPDATE public.terms_of_services SET account_id=100000000000001 "
         "WHERE account_id=1;", False, "fk_rails_337ba633a9", None),
        ("stale_local_id_on_terms", "UPDATE public.terms_of_services SET account_id=999999 "
         "WHERE account_id=1;", False, "fk_rails_337ba633a9", None),
        ("duplicate_existing_terms", "INSERT INTO public.terms_of_services "
         "(id,account_id,terms_type,passive,created_at,updated_at,workflow_state) "
         "VALUES (-900000000000002001,1,'default',true,now(),now(),'active');",
         False, "unique constraint", None),
        ("legacy_schema_search_path", "SET LOCAL search_path TO pg_temp;\n"
         "SELECT count(*) FROM terms_of_services;", False, "does not exist", None),
        ("valid_nonroot_account_sql_only", "INSERT INTO public.terms_of_services "
         "(id,account_id,terms_type,passive,created_at,updated_at,workflow_state) "
         "VALUES (-900000000000002002,4,'default',true,now(),now(),'active');",
         True, None, None),
        ("missing_shard_reference", "SELECT count(*) FROM public.switchman_shards WHERE id=10;",
         True, None, 0),
        ("global_id_not_stored_as_local", "SELECT count(*) FROM public.accounts WHERE id=100000000000001;",
         True, None, 0),
    ]
    return [experiment(container,database,name,sql_text,success=success,marker=marker,
                       expected_output=output)
            for name,sql_text,success,marker,output in scenarios]

def get_fingerprint(container, database):
    result = sql(container, database, FINGERPRINT)
    if result.returncode or not re.fullmatch(r"[0-9a-f]{32}", decode(result)):
        raise RuntimeError("Could not verify snapshot fingerprint")
    return decode(result)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", default=DEFAULT_CONTAINER)
    parser.add_argument("--project", default=DEFAULT_PROJECT)
    parser.add_argument("--qa-canvas-dir", default=str(Path.home() /
                        "qa-feedback-20261110/clean/canvas-lms-master"))
    parser.add_argument("--report", required=True)
    args=parser.parse_args()
    verified_target(args.container,args.project,args.qa_canvas_dir)
    ephemeral = PREFIX + uuid.uuid4().hex[:12]
    report = {
        "time":datetime.now(timezone.utc).isoformat(),
        "qaProject":args.project,
        "sourceDatabase":SOURCE_DATABASE,
        "temporaryDatabase":ephemeral,
        "databaseCloneType":"selected tables (accounts, terms_of_services, switchman_shards) from isolated QA",
        "purpose":"Test incompatible states; not reproduce Canvas login under Rails",
        "scenarios":[], "cleanupConfirmed":False
    }
    created = False
    try:
        existing = sql(args.container,"postgres",
                       "SELECT COUNT(*) FROM pg_database WHERE datname='"+ephemeral+"';")
        if existing.returncode or decode(existing)!="0":
            raise RuntimeError("Temporary database name collision or unreadable catalog")
        # Selected real schemas and records preserve the exact terms_of_services FK
        # without restoring hundreds of unrelated Canvas tables and jobs.
        tables=["public.accounts","public.terms_of_services","public.switchman_shards"]
        selected=[arg for table in tables for arg in ("-t",table)]
        dump=docker(args.container,"pg_dump","-Fc","-U","postgres","-d",SOURCE_DATABASE,
                    *selected, timeout=90)
        if dump.returncode or not dump.stdout.startswith(b"PGDMP"):
            raise RuntimeError("Selected-table pg_dump failed")
        toc=docker(args.container,"pg_restore","-l",input_data=dump.stdout,timeout=30)
        if toc.returncode: raise RuntimeError("Cannot inspect pg_restore TOC")
        toc_lines=toc.stdout.decode("utf-8").splitlines(keepends=True)
        # Exclude unrelated FK dependencies and triggers requiring Canvas-specific
        # functions from the full Rails schema. Keep the *actual* ToS FK and indexes.
        allowed_fk="fk_rails_337ba633a9"
        selected_toc="".join(
            (";" + line if (
                " TRIGGER " in line or " ACL " in line or
                (" FK CONSTRAINT " in line and allowed_fk not in line)
             ) else line)
            for line in toc_lines)
        with tempfile.TemporaryDirectory(prefix="qa_canvas_snapshot_",
                                         dir=str(Path.home()/"qa-feedback-20261110/artifacts")) as temporary:
            archive=Path(temporary)/(ephemeral+".dump")
            listing=Path(temporary)/(ephemeral+".list")
            archive.write_bytes(dump.stdout)
            listing.write_text(selected_toc)
            archive.chmod(0o600)
            listing.chmod(0o600)
            archive_in="/tmp/"+ephemeral+".dump"
            list_in="/tmp/"+ephemeral+".list"
            try:
                for src,dest in ((archive,archive_in),(listing,list_in)):
                    copied=run(["docker","cp",str(src),args.container+":"+dest],timeout=25)
                    if copied.returncode: raise RuntimeError("Could not place QA-only snapshot in container")
                created_db=docker(args.container,"createdb","-U","postgres",ephemeral,timeout=30)
                if created_db.returncode: raise RuntimeError("Temporary database could not be created")
                created=True
                restored=docker(args.container,"pg_restore","-U","postgres",
                                "--exit-on-error","--no-owner","--no-privileges",
                                "--use-list="+list_in,"-d",ephemeral,archive_in,timeout=120)
                if restored.returncode:
                    raise RuntimeError("Selected-table restore failed: "+
                                       restored.stderr.decode(errors="replace")[-250:])
            finally:
                # Remove ONLY the uniquely prefixed files we copied into the QA container.
                docker(args.container,"rm","-f",archive_in,list_in,timeout=15)
        source_hash=get_fingerprint(args.container,SOURCE_DATABASE)
        initial_hash=get_fingerprint(args.container,ephemeral)
        report["snapshotMatchedSource"]=source_hash==initial_hash
        if not report["snapshotMatchedSource"]:
            raise RuntimeError("Snapshot fingerprint differs from live QA; refusing experiments")
        report["scenarios"]=run_matrix(args.container,ephemeral)
        post_hash=get_fingerprint(args.container,ephemeral)
        source_after=get_fingerprint(args.container,SOURCE_DATABASE)
        report["cloneUnchanged"]=post_hash==initial_hash
        report["sourceUnchanged"]=source_after==source_hash
    finally:
        if created:
            # A timed-out Docker client may leave its own pg_restore backend alive.
            # Terminate ONLY sessions attached to the fresh UUID-named QA database.
            sql(args.container,"postgres",
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname='"+ephemeral+"' AND pid<>pg_backend_pid();")
            deleted=docker(args.container,"dropdb","-U","postgres","--if-exists",ephemeral,timeout=60)
            confirmed=sql(args.container,"postgres",
                          "SELECT COUNT(*) FROM pg_database WHERE datname='"+ephemeral+"';")
            report["cleanupConfirmed"]=(deleted.returncode==0 and confirmed.returncode==0
                                        and decode(confirmed)=="0")
        path=Path(args.report).expanduser().resolve()
        if not str(path).startswith(str(Path.home() / "qa-feedback-20261110") + os.sep):
            raise RuntimeError("Reports are only allowed within the isolated QA artifact directory")
        path.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        path.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
        path.chmod(0o600)
        print("QA_HISTORY_LAB_RESULTS",
              sum(s["passed"] for s in report["scenarios"]), "/",len(report["scenarios"]),
              "snapshotMatched", report.get("snapshotMatchedSource"),
              "sourceUnchanged",report.get("sourceUnchanged"),
              "cloneUnchanged",report.get("cloneUnchanged"),
              "cleanupConfirmed",report["cleanupConfirmed"])
        print("QA_HISTORY_REPORT",str(path))
    return 0 if (report.get("snapshotMatchedSource") and
                 report.get("sourceUnchanged") and report.get("cloneUnchanged") and
                 report["cleanupConfirmed"] and
                 all(case["passed"] for case in report["scenarios"])) else 1

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as error:
        print("QA history lab aborted:",str(error),file=sys.stderr)
        sys.exit(3)
