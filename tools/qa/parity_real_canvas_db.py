#!/usr/bin/env python3
"""Real isolated PostgreSQL / Canvas preflight and FK reproductions for QA parity.

Runs the *referenced revision's* existing Canvas preflight module, or validates
an actual PostgreSQL 23503 error and then passes its synthetic log signature
through the referenced revision's diagnostic classifier. Never uses live data.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import importlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time

DATA = Path("/mnt/d/Documentos/MDL/Informatico/Plugin-Feedback-Parity-QA")
ENGLISH = Path("/home/jaime/proyectos/Plugin-Feedback-Canvas")
FLAGS = ("QA_ALLOW_CANVAS_PREFLIGHT_REAL_E2E", "PLUGIN_TEST_MODE", "PLUGIN_QA_NO_BROWSER")

def require(ok, reason):
    if not ok:
        raise RuntimeError(reason)

def cmd(args, *, cwd=None, stdin=None, timeout=90, env=None):
    try:
        return subprocess.run(args, cwd=cwd, input=stdin, text=True, capture_output=True,
                              timeout=timeout, env=env or os.environ.copy())
    except subprocess.TimeoutExpired:
        raise RuntimeError("Bounded disposable QA command timed out")

def unchanged_snapshot():
    r = cmd(["docker", "ps", "-a", "--format", "{{.ID}}|{{.Names}}|{{.Status}}"], timeout=30)
    require(r.returncode == 0, "Docker cannot be inspected")
    return sorted(line for line in r.stdout.splitlines() if
                  not re.search(r"\|qa-preflight-[a-f0-9]{12}-", line))

def actual_fk(source, module, artifacts):
    owner = "qa-preflight-" + secrets.token_hex(6)
    outcome = {
        "scope": "disposable_postgres_real_fk_then_diagnostic",
        "fullRailsLoginReproduced": False,
        "actualPostgresqlFkViolation": False,
        "referentialIntegrityPreserved": False,
        "diagnosticCode": None,
        "cleanupConfirmed": False,
    }
    with tempfile.TemporaryDirectory(prefix=owner, dir=artifacts) as temp:
        work = Path(temp) / owner
        work.mkdir()
        (work / "compose.yml").write_text(module.compose_file(owner), encoding="utf8")
        prefix = ["docker", "compose", "-p", owner, "-f", str(work / "compose.yml")]
        def compose(*a, timeout=100):
            return cmd([*prefix, *a], cwd=source, timeout=timeout)
        container = owner + "-postgres-1"
        active = False
        try:
            active = True
            outcome["lastStage"] = "before_docker_up"
            started = compose("up", "-d", "--wait", timeout=135)
            require(started.returncode == 0, "Disposable PostgreSQL failed to start")
            outcome["lastStage"] = "docker_up"
            module.validated_owner(container, owner)
            outcome["lastStage"] = "identity_verified"
            # Docker can mark the container healthy before PostgreSQL completes
            # the creation of the requested database. Wait for actual SQL access.
            for attempt in range(12):
                ready = module.sql(container, owner, "SELECT 1;")
                if ready.returncode == 0 and ready.stdout.strip() == "1":
                    break
                time.sleep(1)
            else:
                raise RuntimeError("Disposable database never became SQL-ready")
            outcome["lastStage"] = "database_ready"
            schema = module.sql(container, owner, """BEGIN;
CREATE TABLE public.accounts(id bigint PRIMARY KEY);
CREATE TABLE public.terms_of_services(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL,
  CONSTRAINT fk_rails_337ba633a9 FOREIGN KEY(account_id)
  REFERENCES public.accounts(id)
);
INSERT INTO public.accounts(id) VALUES (1);
COMMIT;""")
            outcome["schemaBootstrapSuccessful"] = schema.returncode == 0
            require(schema.returncode == 0, "Synthetic Canvas schema could not be created")
            outcome["lastStage"] = "schema_created"
            module.validated_owner(container, owner)
            failed = cmd(["docker", "exec", "-i", container, "psql",
                "-X", "-q", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose",
                "-U", "postgres", "-d", "canvas_development"],
                stdin="INSERT INTO terms_of_services(account_id) VALUES (999999999);",
                timeout=25)
            error = (failed.stderr + failed.stdout)
            outcome["sqlViolationObservations"] = {
                "nonzeroExit": failed.returncode != 0,
                "sqlstate23503Seen": "23503" in error,
                "constraintNameSeen": "fk_rails_337ba633a9" in error,
                "tableNameSeen": "terms_of_services" in error,
                "stderrPresent": bool(failed.stderr.strip()),
            }
            outcome["actualPostgresqlFkViolation"] = all(
                outcome["sqlViolationObservations"][key]
                for key in ("nonzeroExit", "sqlstate23503Seen", "constraintNameSeen", "tableNameSeen")
            )
            require(outcome["actualPostgresqlFkViolation"],
                    "Exact synthetic PostgreSQL foreign-key constraint was not reproduced")
            verification = module.sql(container, owner, """BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
  'accounts', (SELECT count(*) FROM public.accounts),
  'terms', (SELECT count(*) FROM public.terms_of_services)
);
ROLLBACK;""")
            require(verification.returncode == 0, "Read-only integrity verification failed")
            values = json.loads(verification.stdout.strip().splitlines()[-1])
            outcome["referentialIntegrityPreserved"] = (
                values == {"accounts": 1, "terms": 0})
            require(outcome["referentialIntegrityPreserved"],
                    "Synthetic FK failure did not preserve database state")
            # An actual SQL violation is provided as a synthetic Rails-signature
            # fixture. It is NOT claimed to reproduce a real Canvas controller.
            javascript = """
import {analyzeLogString} from './apps/installer/src/installation/utils/Diagnostics.js';
const input=[]; for await(const chunk of process.stdin) input.push(chunk);
const result=analyzeLogString(input.join(''));
process.stdout.write(JSON.stringify({type:result.type,hasSafetyWarning:
  /(?:do not .*?(?:delete|reset).*?volumes)|(?:no (?:borre|elimine|reinicie).*?vol[uú]men)/i.test(result.solution)}));
"""
            incident = cmd(["node", "--input-type=module", "-e", javascript],
                           cwd=source, stdin="PG::ForeignKeyViolation: " + error,
                           timeout=30)
            require(incident.returncode == 0,
                    "Canvas error classifier could not run against real SQL error")
            diagnosis = json.loads(incident.stdout)
            outcome["diagnosticCode"] = diagnosis.get("type")
            outcome["unsafeAutomaticResetRejected"] = diagnosis.get("hasSafetyWarning") is True
            require(outcome["diagnosticCode"] == "CANVAS_TERMS_FOREIGN_KEY",
                    "Expected Canvas FK diagnosis was not reproduced")
            require(outcome["unsafeAutomaticResetRejected"],
                    "The diagnostic did not clearly discourage destructive reset")
            outcome["status"] = "PASS"
        except Exception as e:
            outcome["status"] = "FAIL"
            outcome["failureClass"] = type(e).__name__
            outcome["failureStage"] = outcome.get("lastStage", "before_start")
        finally:
            if active:
                try:
                    module.validated_owner(container, owner)
                    outcome["cleanupConfirmed"] = compose("down", "-v", timeout=100).returncode == 0
                except Exception:
                    outcome["cleanupConfirmed"] = False
            if not outcome["cleanupConfirmed"]:
                outcome["status"] = "FAIL"
    return outcome

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", required=True)
    p.add_argument("--report", required=True)
    p.add_argument("--suite", choices=("preflight", "foreign-key"), required=True)
    a = p.parse_args()
    for flag in FLAGS:
        require(os.getenv(flag) == "true", "Missing isolated QA authorization: " + flag)
    source = Path(a.source).resolve(strict=True)
    root = DATA.resolve(strict=True)
    require(source == ENGLISH or source.is_relative_to(root),
            "Source outside approved repository or D laboratory")
    require((source / "tools/qa/qa_canvas_preflight_recovery_e2e.py").is_file(),
            "Source revision does not include the Canvas preflight test")
    report = Path(a.report).resolve()
    require(report.suffix == ".json" and report.is_relative_to(root) and not report.is_symlink(),
            "Report path outside isolated D laboratory")
    report.parent.mkdir(parents=True, exist_ok=True)
    previous_home = os.environ.get("HOME")
    os.environ["HOME"] = str(root)
    artifacts = root / "qa-feedback-20261110" / "artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(source / "tools/qa"))
    module = importlib.import_module("qa_canvas_preflight_recovery_e2e")
    before = unchanged_snapshot()
    if a.suite == "preflight":
        with tempfile.TemporaryDirectory(prefix="qa-preflight-" + secrets.token_hex(6),
                                        dir=artifacts) as tmp:
            owner = Path(tmp).name[:25]  # avoid using arbitrary existing Docker project
            owner = "qa-preflight-" + secrets.token_hex(6)
            work = Path(tmp) / owner
            work.mkdir()
            details = module.scenario(work, owner)
    else:
        details = actual_fk(source, module, artifacts)
    after = unchanged_snapshot()
    require(before == after, "Unrelated Docker container state unexpectedly changed")
    revision = cmd(["git", "-C", str(source), "rev-parse", "HEAD"])
    require(revision.returncode == 0, "Git source revision unavailable")
    result = {
        "schema": "qa-parity-canvas-real-v1",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "sourceCommit": revision.stdout.strip(),
        "suite": a.suite,
        "otherContainersUnchanged": True,
        "disposableOnly": True,
        "details": details,
    }
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    report.chmod(0o600)
    status = details.get("status")
    print("QA_PARITY_CANVAS_DB", a.suite, status,
          "cleanup", details.get("cleanupConfirmed"), flush=True)
    print("QA_EVIDENCE", report, flush=True)
    if previous_home is None:
        os.environ.pop("HOME", None)
    else:
        os.environ["HOME"] = previous_home
    return 0 if details.get("cleanupConfirmed") and status in ("PASS_RECOVERED", "PASS") else 2

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as ex:
        print("QA_PARITY_CANVAS_BLOCKED", type(ex).__name__, flush=True)
        sys.exit(3)
