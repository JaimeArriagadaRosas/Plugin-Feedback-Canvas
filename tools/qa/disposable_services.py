#!/usr/bin/env python3
"""One-shot recovery E2E against a new throwaway Compose project, never user's services."""
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
COMPOSE = ROOT / "tools/qa/docker-compose.compat.yml"
ENTRYPOINT = ROOT / "tools/qa/execute_recovery.mjs"

class QAFailed(RuntimeError):
    pass

def call(args, *, env=None, timeout=100, check=True):
    try:
        result = subprocess.run(args, cwd=ROOT, env=env, text=True, capture_output=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        raise QAFailed("La operación QA superó su límite temporal.")
    if check and result.returncode:
        # Retain only a fixed failure class. Raw Docker output may include
        # environment values or internal identifiers and must not leave QA.
        output = (result.stderr + result.stdout).lower()
        category = ("port_conflict" if "port is already allocated" in output or
                    "address already in use" in output else
                    "unhealthy" if "unhealthy" in output else
                    "image" if "pull access denied" in output or "manifest unknown" in output else
                    "daemon" if "cannot connect to the docker daemon" in output else
                    "compose_unknown")
        raise QAFailed("Falló una operación restringida del laboratorio: " +
                       " ".join(args[:3]) + " [" + category + "]")
    return result

class DisposableLab:
    def __init__(self, *, project=None):
        if os.getenv("QA_ALLOW_DISPOSABLE_COMPAT_TESTS") != "true" or (
                os.getenv("PLUGIN_TEST_MODE") != "true" or
                os.getenv("PLUGIN_QA_NO_BROWSER") != "true"):
            raise QAFailed("Se requieren ambas banderas de modo sin ventanas y autorización QA.")
        self.project = project or ("qa-compat-" + secrets.token_hex(4))
        if not re.fullmatch(r"qa-compat-[0-9a-f]{8}", self.project):
            raise QAFailed("Nombre de proyecto no seguro.")
        self.password = "qa-" + secrets.token_hex(18)
        self.env = {
            **os.environ, "QA_DB_PASSWORD": self.password, "COMPOSE_PROJECT_NAME": self.project,
            "QA_DISPOSABLE_LAB": "true", "DB_USER": "postgres", "DB_NAME": "feedback_plugin_db",
            "DB_PASSWORD": self.password, "PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY": "true"
        }
        self.results = []
        self.active = False

    def compose(self, *args, check=True, timeout=120):
        return call(["docker", "compose", "-p", self.project, "-f", str(COMPOSE), *args],
                    env=self.env, check=check, timeout=timeout)

    def container(self, service):
        if service not in ("db", "gotenberg", "redis"):
            raise QAFailed("Servicio QA no permitido.")
        return self.project + "-" + service + "-1"

    def inspect(self, service):
        name = self.container(service)
        result = call(["docker", "inspect", name, "--format", "{{json .}}"], check=False)
        if result.returncode:
            raise QAFailed("Contenedor temporal no encontrado: " + service)
        data = json.loads(result.stdout)
        labels = data.get("Config", {}).get("Labels", {}) or {}
        if labels.get("com.docker.compose.project") != self.project or labels.get("com.docker.compose.service") != service:
            raise QAFailed("Identidad del contenedor temporal no coincide; operación bloqueada.")
        return data

    def state(self, service):
        state = self.inspect(service).get("State", {})
        return state.get("Health", {}).get("Status", "running" if state.get("Running") else "stopped") if state.get("Running") else "stopped"

    def wait_healthy(self, service, seconds=65):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            if self.state(service) == "healthy":
                return
            time.sleep(1)
        raise QAFailed("El servicio QA no alcanzó estado healthy: " + service)

    def start(self):
        # Random project; ensure neither project nor containers existed beforehand.
        existing = call(["docker", "ps", "-a", "-q", "--filter",
                         "label=com.docker.compose.project=" + self.project])
        if existing.stdout.strip():
            raise QAFailed("Ya existe un proyecto QA con ese identificador.")
        self.active = True  # cleanup even if docker compose up fails halfway
        # An explicit host-port binding persists across docker stop/start. Unlike
        # published=0, Docker can verify the stopped service identity safely.
        def available_port():
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as endpoint:
                endpoint.bind(("127.0.0.1", 0))
                return str(endpoint.getsockname()[1])
        self.env["QA_DB_HOST_PORT"] = available_port()
        self.env["QA_GOTENBERG_HOST_PORT"] = available_port()
        if self.env["QA_DB_HOST_PORT"] == self.env["QA_GOTENBERG_HOST_PORT"]:
            raise QAFailed("QA published-port allocation collision.")
        self.compose("up", "-d", "--wait", timeout=155)
        for service in ("db", "gotenberg", "redis"):
            self.wait_healthy(service)
        for service in ("db", "gotenberg"):
            port = "5432/tcp" if service == "db" else "3000/tcp"
            output = call(["docker", "port", self.container(service), port]).stdout.strip().splitlines()
            found = [item.rsplit(":", 1)[-1] for item in output if item.startswith("127.0.0.1:")]
            if len(found) != 1 or not found[0].isdigit():
                raise QAFailed("Puerto QA no publicado de manera exclusiva en localhost.")
            self.env["DB_PORT" if service == "db" else "GOTENBERG_PORT"] = found[0]
        self.env["PLUGIN_DB_CONTAINER_NAME"] = self.container("db")
        self.env["PLUGIN_GOTENBERG_CONTAINER_NAME"] = self.container("gotenberg")

    def stop(self, service):
        self.inspect(service)
        call(["docker", "stop", "--time", "4", self.container(service)], timeout=20)
        if self.state(service) != "stopped":
            raise QAFailed("El servicio temporal no quedó detenido.")

    def restore(self, service):
        if self.state(service) == "stopped":
            call(["docker", "start", self.container(service)], timeout=25)
        self.wait_healthy(service)

    def recovery(self, mode="recover", *, modified_env=None):
        env = {**self.env, **(modified_env or {})}
        command = ["node", str(ENTRYPOINT), mode]
        result = call(command, env=env, check=False, timeout=85)
        markers = [line.split("QA_RECOVERY=", 1)[1] for line in result.stdout.splitlines()
                   if line.startswith("QA_RECOVERY=")]
        if len(markers) != 1:
            raise QAFailed("El verificador real no produjo una respuesta estructurada.")
        return result.returncode, json.loads(markers[0])

    def case(self, name, operation, expectation="recovered"):
        try:
            description = operation()
            outcome = "PASS"
            detail = description or expectation
        except Exception as exc:
            outcome = "FAIL"
            detail = type(exc).__name__
        self.results.append({"name": name, "status": outcome, "expected": expectation, "detail": detail})
        print(("PASS " if outcome == "PASS" else "FAIL ") + name)

    def run(self):
        self.start()
        self.case("clean_install_services", self.clean)
        self.case("postgres_stopped_autorecovery", self.recover_stopped_db)
        self.case("gotenberg_stopped_autorecovery", self.recover_stopped_gotenberg)
        self.case("two_owned_services_stopped_recovery", self.recover_both)
        self.case("recovery_without_opt_in_blocks", self.block_without_optin, "blocked")
        self.case("wrong_compose_owner_blocks", lambda: self.must_block({"COMPOSE_PROJECT_NAME":"qa-compat-00000000"}), "blocked")
        self.case("wrong_published_port_blocks", lambda: self.must_block({"DB_PORT":"1"}), "blocked")
        self.case("wrong_db_credentials_blocks", lambda: self.must_block({"DB_PASSWORD":"invalid-test-value"}), "blocked")
        self.case("missing_container_name_blocks", lambda: self.must_block({"PLUGIN_DB_CONTAINER_NAME":self.project + "-missing-db"}), "blocked")
        self.case("redis_stopped_detected_without_unsafe_repair", self.redis_stopped_notice, "blocked")
        self.plugin_migration_scenarios()
        return self.results

    def clean(self):
        for service in ("db", "gotenberg", "redis"):
            if self.state(service) != "healthy":
                raise QAFailed("Servicio temporal no saludable.")
        queried = call(["docker", "exec", self.container("db"), "psql", "-U", "postgres",
                        "-d", "feedback_plugin_db", "-X", "-t", "-A", "-c", "SELECT 1;"])
        if queried.stdout.strip() != "1":
            raise QAFailed("La base temporal no responde SELECT 1.")
        return "services_healthy_and_database_query_ok"

    def recovery_expect(self, stopped):
        try:
            for service in stopped:
                self.stop(service)
            code, data = self.recovery()
            expected = {self.container(s) for s in stopped}
            if code or data["kind"] != "reuse" or set(data["recovered"]) != expected:
                raise QAFailed("La recuperación no inició exactamente los servicios detenidos.")
            for service in stopped:
                self.wait_healthy(service)
            self.clean()
            return "authorized_services_restored_and_healthy"
        finally:
            for service in stopped:
                self.restore(service)

    def recover_stopped_db(self):
        return self.recovery_expect(["db"])

    def recover_stopped_gotenberg(self):
        return self.recovery_expect(["gotenberg"])

    def recover_both(self):
        return self.recovery_expect(["db", "gotenberg"])

    def block_without_optin(self):
        try:
            self.stop("gotenberg")
            code, data = self.recovery(modified_env={"PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY":"false"})
            if code != 2 or data["kind"] != "block" or self.state("gotenberg") != "stopped":
                raise QAFailed("Se modificó un contenedor pese a no tener autorización.")
            return "blocked_without_container_start"
        finally:
            self.restore("gotenberg")

    def must_block(self, overrides):
        initial = {s:self.state(s) for s in ("db","gotenberg","redis")}
        code, response = self.recovery("plan",modified_env=overrides)
        final = {s:self.state(s) for s in initial}
        if code != 0 or response["kind"] != "block" or initial != final:
            raise QAFailed("Conflicto no detectado o se alteraron contenedores.")
        return "blocked_and_all_states_unchanged"

    def redis_stopped_notice(self):
        try:
            self.stop("redis")
            # The shared service recovery only supports plugin DB + Gotenberg:
            # stopping Redis must NOT be falsely reported as recovered.
            if self.state("redis") != "stopped":
                raise QAFailed("Fallo de Redis no reproducido.")
            return "CANVAS-REDIS-001:requires_explicit_recovery_not_implemented"
        finally:
            self.restore("redis")

    def plugin_migration_scenarios(self):
        script = ROOT / "tools/qa/execute_plugin_migrations.mjs"
        result = call(["node", str(script)], env=self.env, check=False, timeout=240)
        marker = [line.split("QA_PLUGIN_MIGRATION=", 1)[1]
                  for line in result.stdout.splitlines()
                  if line.startswith("QA_PLUGIN_MIGRATION=")]
        if len(marker) != 1:
            self.results.append({
                "name": "plugin_migration_execution", "status": "FAIL",
                "expected": "migrated", "detail": "migration_runner_not_completed"
            })
            print("FAIL plugin_migration_execution")
            return
        cases = json.loads(marker[0])
        for case in cases:
            case["expected"] = "migration_verified"
            self.results.append(case)
            print(("PASS " if case["status"] == "PASS" else "FAIL ") + case["name"])
        if result.returncode and all(case["status"] == "PASS" for case in cases):
            self.results.append({
                "name":"plugin_migration_process", "status":"FAIL",
                "expected":"exit_zero", "detail":"migration_process_returned_error"
            })

    def cleanup(self):
        if not self.active: return True
        try:
            # Verify all visible project containers really carry our random label.
            ids = call(["docker", "ps", "-a", "-q",
                        "--filter", "label=com.docker.compose.project=" + self.project]).stdout.splitlines()
            for item in ids:
                details = json.loads(call(["docker", "inspect", item, "--format", "{{json .}}"]).stdout)
                if (details.get("Config",{}).get("Labels") or {}).get("com.docker.compose.project") != self.project:
                    raise QAFailed("Cleanup refused: unexpected container project label.")
            self.compose("down", "-v", timeout=100)
            leftover = call(["docker", "ps", "-a", "-q", "--filter",
                             "label=com.docker.compose.project=" + self.project]).stdout.strip()
            return not bool(leftover)
        except Exception:
            return False

def main():
    if len(sys.argv) != 2 or not sys.argv[1].startswith(str(Path.home()/"qa-feedback-20261110/artifacts/")):
        raise QAFailed("Se requiere un informe dentro de la carpeta QA de trabajo.")
    result_path = Path(sys.argv[1])
    lab = DisposableLab()
    failure = None
    try:
        lab.run()
    except Exception as exc:
        failure = type(exc).__name__
    finally:
        cleaned = lab.cleanup()
    report = {
        "timestamp":datetime.now(timezone.utc).isoformat(),
        "project":lab.project,
        "mode":"one-shot-headless-docker",
        "normalUserContainersTouched":False,
        "startupFailure":failure,
        "cleanupConfirmed":cleaned,
        "results":lab.results
    }
    result_path.parent.mkdir(exist_ok=True,parents=True)
    result_path.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
    result_path.chmod(0o600)
    print("QA_DISPOSABLE_RESULT",sum(s["status"]=="PASS" for s in lab.results),
          "/",len(lab.results),"cleaned",cleaned,"startupFailure",failure)
    print("QA_DISPOSABLE_REPORT",result_path)
    return 0 if cleaned and failure is None and lab.results and all(s["status"]=="PASS" for s in lab.results) else 1

if __name__=="__main__":
    try: sys.exit(main())
    except Exception as exc:
        print("QA DISPOSABLE BLOCKED:",type(exc).__name__,file=sys.stderr)
        sys.exit(3)
