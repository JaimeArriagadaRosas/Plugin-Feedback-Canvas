import logging

from constants import CANVAS_DIR, MIN_RAM_GB
from runner import run_command
from spinner import Spinner

logger = logging.getLogger(__name__)


def check_docker():
    success, out, err = run_command(["docker", "info"])
    if success:
        mem_success, mem_out, _ = run_command(["docker", "info", "--format", "{{.MemTotal}}"])
        if mem_success and mem_out.strip().isdigit():
            mem_gb = int(mem_out.strip()) / (1024**3)
            if mem_gb < MIN_RAM_GB:
                logger.info("Docker en ejecución, pero solo tiene %.1fGB RAM asignados (Canvas requiere 8GB+)", mem_gb)
            else:
                logger.info("Docker en ejecución (%.1fGB RAM asignados)", mem_gb)
        else:
            logger.info("Docker en ejecución")
        return True, {}

    cli_success, _, _ = run_command(["docker", "--version"])
    if cli_success:
        logger.error("Docker está instalado, pero el daemon no está corriendo. Abre Docker Desktop.")
        return False, {"docker_daemon_down": True}
    logger.error("Docker no está instalado o no está en el PATH.")
    return False, {"missing_docker": True}


def check_docker_compose():
    success, out, err = run_command(["docker", "compose", "version"])
    if success:
        logger.info("Docker Compose disponible: %s", out)
        return True, {}
    logger.error("Docker Compose no está disponible.")
    return False, {"missing_compose": True}


def check_canvas_clone():
    if (CANVAS_DIR / "docker-compose.yml").exists():
        logger.info("Clon de Canvas LMS encontrado en %s", CANVAS_DIR)
        return True, {}
    logger.error("No se encontró el clon de Canvas LMS en %s", CANVAS_DIR)
    return False, {"missing_canvas_clone": True}


def check_canvas_assets():
    if not (CANVAS_DIR / "docker-compose.yml").exists():
        return True, {}

    manifest_dev = CANVAS_DIR / "public" / "dist" / "webpack-dev" / "webpack-manifest.json"
    manifest_prod = CANVAS_DIR / "public" / "dist" / "webpack-manifest.json"

    if manifest_dev.exists() or manifest_prod.exists():
        logger.info("Assets compilados de Canvas encontrados (localmente).")
        return True, {}

    logger.error("Faltan los assets compilados de Canvas LMS o están incompletos (Falta CSS o JS).")
    return False, {"missing_canvas_assets": True}


def check_node():
    success, out, err = run_command(["node", "--version"])
    if success:
        logger.info("Node.js disponible: %s", out)
        return True, {}
    logger.error("Node.js no está instalado o no está en el PATH.")
    return False, {"missing_node": True}


def check_npm():
    import platform
    is_win = platform.system() == "Windows"
    success, out, err = run_command(["npm", "--version"] if not is_win else "npm --version", shell=is_win)
    if success:
        logger.info("NPM disponible: %s", out)
        return True, {}
    logger.error("NPM no está instalado o no está en el PATH.")
    return False, {"missing_npm": True}


def run_preflight_checks():
    logger.info("Iniciando verificación de componentes estáticos")
    print("\n\033[36m" + "=" * 54 + "\033[0m")
    print("   \033[1;37mVERIFICACION DE COMPONENTES - CANVAS LMS LOCAL\033[0m")
    print("\033[36m" + "=" * 54 + "\033[0m\n")

    checks = [
        ("Docker", check_docker),
        ("Docker Compose", check_docker_compose),
        ("Canvas LMS clone", check_canvas_clone),
        ("Node.js", check_node),
        ("NPM", check_npm),
        ("Canvas Assets", check_canvas_assets),
    ]

    missing = {}
    all_ok = True
    for idx, (name, fn) in enumerate(checks, start=1):
        spinner = Spinner(f"[{idx}/6] Verificando {name}...")
        spinner.start()
        ok, details = fn()
        if not ok:
            all_ok = False
            missing.update(details)
            spinner.stop(f"[\033[31mFAIL\033[0m] {name}")
            logger.error("Check fallido: %s", name)
        else:
            spinner.stop(f"[\033[32mOK\033[0m] {name}")
            logger.info("Check exitoso: %s", name)
    print()
    logger.info("Verificación de componentes estáticos completada. all_ok=%s", all_ok)
    return all_ok, missing
