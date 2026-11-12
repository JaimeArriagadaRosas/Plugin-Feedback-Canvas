#!/usr/bin/env python3
"""Real PostgreSQL FK failures on a *copied* disposable Canvas database.

No SQL is run on historical containers. All attempted writes use explicit
transactions without COMMIT; expected violations abort and roll back.
"""
from __future__ import annotations
import json
import re
import subprocess

from historical_full_stack import QABlocked

OWNER = re.compile(r"qa-hpair-[0-9a-f]{12}-db")
FK = "fk_rails_337ba633a9"
DUMMY = -9000000000000000888

def verified_database(container):
    if not OWNER.fullmatch(container):
        raise QABlocked("FK injection requires a disposable Canvas PostgreSQL copy")
    try:
        response = subprocess.run(["docker", "inspect", container, "--format", "{{json .}}"],
                                  capture_output=True, text=True, timeout=15, check=False)
    except subprocess.TimeoutExpired as exc:
        raise QABlocked("Disposable database owner inspection timed out") from exc
    if response.returncode:
        raise QABlocked("Disposable database unavailable")
    try:
        value = json.loads(response.stdout)
        labels = value["Config"]["Labels"]
    except (ValueError, KeyError, TypeError) as exc:
        raise QABlocked("Unverifiable QA ownership metadata") from exc
    if (labels.get("qa.canvas.pair.disposable") != "true" or
        labels.get("qa.canvas.pair.owner") != container.removesuffix("-db") or
        value.get("State", {}).get("Running") is not True):
        raise QABlocked("Container is not a running, owned QA database")
    return True

def postgres(container, sql, *, expected_failure=False):
    verified_database(container)
    # No DO blocks, Rails commands or arbitrary dynamic SQL: only this module's
    # predefined statements are passed to PostgreSQL.
    try:
        proc = subprocess.run(
            ["docker", "exec", "-i", container, "psql", "-X", "-q", "-A", "-t",
             "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "canvas_development"],
            input=sql, text=True, capture_output=True, timeout=35, check=False)
    except subprocess.TimeoutExpired as exc:
        raise QABlocked("Disposable FK transaction timed out") from exc
    if expected_failure:
        return proc.returncode != 0, proc.stderr
    if proc.returncode:
        raise QABlocked("Read-only FK baseline or control transaction failed")
    return proc.stdout.strip()

FINGERPRINT = """BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
 'accountIds', (SELECT md5(COALESCE(string_agg(id::text, ',' ORDER BY id), ''))
                FROM public.accounts),
 'termsLinks', (SELECT md5(COALESCE(string_agg(id::text || ':' || account_id::text,
                  ',' ORDER BY id), '')) FROM public.terms_of_services),
 'shards', (SELECT md5(COALESCE(string_agg(id::text, ',' ORDER BY id), ''))
            FROM public.switchman_shards),
 'migrations', (SELECT md5(COALESCE(string_agg(version::text, ',' ORDER BY version), ''))
                FROM public.schema_migrations),
 'orphans', (SELECT count(*) FROM public.terms_of_services t LEFT JOIN
             public.accounts a ON a.id = t.account_id WHERE a.id IS NULL),
 'constraint', (SELECT count(*) FROM pg_constraint WHERE conname='fk_rails_337ba633a9'
                AND contype='f' AND convalidated
                AND conrelid='public.terms_of_services'::regclass
                AND confrelid='public.accounts'::regclass)
);
ROLLBACK;"""

def snapshot(container):
    try:
        value = json.loads(postgres(container, FINGERPRINT).splitlines()[-1])
    except (ValueError, IndexError) as exc:
        raise QABlocked("Invalid disposable Canvas fingerprint") from exc
    if (value.get("constraint") != 1 or value.get("orphans") != 0 or
        not all(re.fullmatch(r"[0-9a-f]{32}", str(value.get(k, "")))
                for k in ("accountIds", "termsLinks", "shards", "migrations"))):
        raise QABlocked("Original FK constraint or initial integrity unavailable")
    return value

def sql_insertion(account_id):
    if not isinstance(account_id, int) or account_id <= 0 or account_id > 999999999999999999:
        raise QABlocked("Invalid test account reference")
    return (f"BEGIN; INSERT INTO public.terms_of_services "
            f"(id, account_id, terms_type, passive, created_at, updated_at, workflow_state) "
            f"VALUES ({DUMMY}, {account_id}, 'default', true, now(), now(), 'active'); ROLLBACK;")

def case_failure(container, name, account_id):
    rejected, stderr = postgres(container, sql_insertion(account_id), expected_failure=True)
    # These are actual PostgreSQL error details, not a fabricated Rails 500.
    matched = rejected and FK in stderr and "violates foreign key constraint" in stderr.lower()
    return {"name": name, "status": "PASS_SAFE_BLOCK" if matched else "FAIL",
            "postgresConstraintObserved":matched, "committed":False,
            "railsLoginNaturallyReproduced":False}

def positive_control(container):
    sql = """BEGIN TRANSACTION READ ONLY;
SELECT a.id FROM public.accounts a WHERE a.id > 0 AND NOT EXISTS (
  SELECT 1 FROM public.terms_of_services t WHERE t.account_id = a.id
) ORDER BY a.id LIMIT 1;
ROLLBACK;"""
    value = postgres(container, sql).splitlines()
    if len(value) != 1 or not re.fullmatch(r"[1-9][0-9]{0,15}", value[0]):
        return {"name":"valid_fk_transaction","status":"BLOCKED_MISSING_FIXTURE",
                "committed":False}
    ok, stderr = postgres(container, sql_insertion(int(value[0])), expected_failure=True)
    # A valid transaction should succeed (return 0), then execute ROLLBACK.
    return {"name":"valid_fk_transaction","status":"PASS_REFERENCE_ACCEPTED" if not ok else "FAIL",
            "committed":False, "validReferenceAccepted":not ok,
            "errorCategory":"unexpected" if ok else None}

def run_matrix(container):
    before = snapshot(container)
    # Never try a reference already present in the disposable dataset.
    candidates = postgres(container, """BEGIN TRANSACTION READ ONLY;
SELECT count(*) FROM public.accounts WHERE id IN (100000000000001, 999999);
ROLLBACK;""")
    if candidates.splitlines() != ["0"]:
        raise QABlocked("Synthetic invalid account IDs unexpectedly exist in QA database")
    cases = [
        case_failure(container, "unregistered_global_account_fk", 100000000000001),
        case_failure(container, "missing_local_account_fk", 999999),
        positive_control(container),
    ]
    after = snapshot(container)
    unchanged = before == after
    statuses = [x["status"] for x in cases]
    status = ("PASS" if unchanged and all(s in ("PASS_SAFE_BLOCK", "PASS_REFERENCE_ACCEPTED")
                                         for s in statuses)
              else "BLOCKED" if unchanged and "BLOCKED_MISSING_FIXTURE" in statuses
              else "FAIL")
    return {"status":status, "cases":cases, "constraintVerified":True,
            "dataIntegrityPreserved":unchanged, "allSQLTransactionsUncommitted":True,
            "userDatabasesTouched":False, "naturalRailsLoginFKReproduced":False,
            "repairPolicy":"protect_and_diagnose; do_not_rewrite_canvas_account_references"}

if __name__ == "__main__":
    raise SystemExit("Use the guarded, disposable Canvas E2E orchestrator")
