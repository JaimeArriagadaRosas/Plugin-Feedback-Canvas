#!/usr/bin/env python3
import sys
import subprocess
import logging
import re
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from constants import RAILS_RUNNER_TIMEOUT
from logging_config import configure_logging
from runner import DOCKER_RAILS_EXEC_PREFIX

PLUGIN_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent
WORKSPACE_DIR = PLUGIN_DIR.parent
CANVAS_DIR = WORKSPACE_DIR / "canvas-lms-master"
SEED_FILE = PLUGIN_DIR / "db" / "seeds" / "local_data.rb"
ENV_FILE = PLUGIN_DIR / ".env"


def poblar_datos():
    configure_logging()
    logger = logging.getLogger(__name__)
    logger.info("Iniciando población de datos de prueba en Canvas LMS")
    print("\n\033[36m=========================================================\033[0m")
    print("   \033[1;37mINICIALIZANDO DATOS DE PRUEBA EN CANVAS LMS\033[0m")
    print("\033[36m=========================================================\033[0m\n")

    if not SEED_FILE.exists():
        logger.error("No se encontró el script de semilla: %s", SEED_FILE)
        print(f"[\033[31mFAIL\033[0m] No se encontró el script de semilla: {SEED_FILE}")
        return False

    print("Leyendo script original (local_data.rb)...")
    try:
        script_content = SEED_FILE.read_text(encoding="utf-8")
    except Exception as e:
        logger.error("Error al leer el script de semilla: %s", e)
        print(f"[\033[31mFAIL\033[0m] Error al leer el script de semilla: {e}")
        return False

    print("Inyectando usuarios y cursos de prueba en Canvas...")
    print("Esto tomará un par de minutos, no cierre la consola...")
    logger.info("Ejecutando script de semilla en contenedor web de Canvas")
    
    try:
        process = subprocess.Popen(
            [*DOCKER_RAILS_EXEC_PREFIX, "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            cwd=str(CANVAS_DIR)
        )

        try:
            stdout, _ = process.communicate(input=script_content, timeout=RAILS_RUNNER_TIMEOUT)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate()
            logger.error("Timeout al inyectar datos de prueba (%ss)", RAILS_RUNNER_TIMEOUT)
            print(f"[\033[31mFAIL\033[0m] La inyección de datos excedió el tiempo límite ({RAILS_RUNNER_TIMEOUT}s).")
            return False
        
        if process.returncode == 0:
            logger.info("Población de datos completada exitosamente")
            print(stdout)
            print("[\033[32mOK\033[0m] ¡Base de datos poblada exitosamente!")
            _sync_canvas_token(logger, stdout)
            return True
        else:
            logger.error("Error al ejecutar el script de semilla. returncode=%s", process.returncode)
            print("[\033[31mFAIL\033[0m] Error al ejecutar el script de semilla.")
            print("\n\033[31mDetalle del error:\033[0m")
            print(stdout)
            return False
            
    except Exception as e:
        logger.error("Excepción al invocar docker compose: %s", e)
        print(f"[\033[31mFAIL\033[0m] Excepción al invocar docker compose: {e}")
        return False


def _sync_canvas_token(logger, seed_output: str):
    """
    Extrae el CANVAS_API_TOKEN de la salida del script de semilla (local_data.rb
    imprime "CANVAS_API_TOKEN:<token>") y actualiza CANVAS_ACCESS_TOKEN en el .env
    del proyecto para que el backend pueda autenticar contra Canvas correctamente.
    """
    match = re.search(r"CANVAS_API_TOKEN:([^\s\r\n]+)", seed_output)
    if match:
        teacher_token = match.group(1).strip()
        if teacher_token:
            _write_canvas_token_to_env(teacher_token, logger)
            return

    # Si no está en la salida, intentar leer del archivo generado en el contenedor
    logger.warning("No se encontró CANVAS_API_TOKEN en la salida del script. Intentando leer desde el contenedor...")
    _sync_token_from_container(logger)


def _sync_token_from_container(logger):
    """Lee perfiles_data.json desde el contenedor Docker y extrae el token del profesor."""
    try:
        result = subprocess.run(
            ["docker", "compose", "exec", "-T", "web", "cat", "/usr/src/app/tmp/perfiles_data.json"],
            capture_output=True, text=True, encoding="utf-8", cwd=str(CANVAS_DIR)
        )
        if result.returncode != 0 or not result.stdout.strip():
            logger.warning("No se pudo leer perfiles_data.json del contenedor: %s", result.stderr)
            return

        perfiles = json.loads(result.stdout)
        teacher = next(
            (u for u in perfiles.get("usuarios", []) if u.get("rol") == "teacher"),
            None
        )
        if not teacher or not teacher.get("token"):
            logger.warning("No se encontró el token del profesor en perfiles_data.json")
            return

        _write_canvas_token_to_env(teacher["token"], logger)

    except Exception as e:
        logger.warning("Error al extraer token del contenedor: %s", e)


def _write_canvas_token_to_env(token: str, logger):
    """Escribe CANVAS_ACCESS_TOKEN en el .env del proyecto."""
    try:
        content = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
        lines = content.splitlines()

        updated = False
        for i, line in enumerate(lines):
            if line.startswith("CANVAS_ACCESS_TOKEN="):
                lines[i] = f"CANVAS_ACCESS_TOKEN={token}"
                updated = True
                break

        if not updated:
            lines.append(f"CANVAS_ACCESS_TOKEN={token}")

        ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
        logger.info("CANVAS_ACCESS_TOKEN actualizado en .env correctamente.")
        print(f"[\033[32mOK\033[0m] CANVAS_ACCESS_TOKEN sincronizado automáticamente en .env.")
    except Exception as e:
        logger.warning("No se pudo escribir CANVAS_ACCESS_TOKEN en .env: %s", e)
        print(f"[\033[33mWARN\033[0m] No se pudo actualizar .env con el token de Canvas: {e}")


if __name__ == "__main__":
    success = poblar_datos()
    sys.exit(0 if success else 1)
