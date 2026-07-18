#!/usr/bin/env python3
import os
import sys
import time
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from logging_config import configure_logging
from constants import RAILS_RUNNER_TIMEOUT
from runner import run_canvas_rails_runner, run_command

PLUGIN_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent
WORKSPACE_DIR = PLUGIN_DIR.parent
CANVAS_DIR = WORKSPACE_DIR / "canvas-lms-master"

configure_logging()
logger = logging.getLogger(__name__)

def check_base_data(max_retries=12, wait_seconds=5):
    logger.info("Verificando existencia de la base de datos de la Universidad (Cursos, Usuarios)...")
    
    ruby_check = "puts User.where(workflow_state: 'registered').count > 0 ? 'DATA_OK' : 'DATA_MISSING'"

    for attempt in range(max_retries):
        success, out, err = run_canvas_rails_runner(
            ruby_check,
            cwd=CANVAS_DIR,
            timeout=RAILS_RUNNER_TIMEOUT,
        )

        if success and "DATA_OK" in out:
            logger.info("Datos base de la institución encontrados en Canvas.")
            return True

        logger.debug("Intento %d fallido para Datos Base. debug=%s %s", attempt + 1, out, err)
        if attempt < max_retries - 1:
            time.sleep(wait_seconds)

    logger.error("Los datos base de la institución no están instalados. debug=%s %s", out, err)
    return False

def main():
    success, out, err = run_command(["docker", "compose", "ps", "-q", "web"], cwd=CANVAS_DIR)
    if not success or not out.strip():
        logger.error("El contenedor 'web' de Canvas no está corriendo. No se puede verificar la BD.")
        sys.exit(1)

    if check_base_data():
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
