import logging
import time

from constants import CANVAS_DIR, HEALTHCHECK_TIMEOUT, HEALTHCHECK_INTERVAL
from runner import run_command
from spinner import Spinner

logger = logging.getLogger(__name__)


def start_canvas_stack():
    logger.info("Iniciando stack de Canvas LMS (docker compose up -d)")
    spinner = Spinner("Iniciando contenedores de Canvas LMS...")
    spinner.start()
    success, out, err = run_command(["docker", "compose", "up", "-d"], shell=False, cwd=str(CANVAS_DIR))
    if success:
        spinner.stop("[\033[32mOK\033[0m] Contenedores de Canvas LMS iniciados")
        logger.info("Contenedores de Canvas LMS iniciados correctamente")
    else:
        spinner.stop(f"[\033[31mFAIL\033[0m] Error al iniciar Canvas LMS: {err}")
        logger.error("Error al iniciar Canvas LMS: %s", err)
    return success


def ensure_ruby_dependencies():
    """
    Verifica que bundle install se haya ejecutado dentro del contenedor web.
    Las gems se instalan en /home/docker/.gem (ephemeral si el contenedor se recrea).
    """
    logger.info("Verificando dependencias Ruby (bundle check)")
    spinner = Spinner("Verificando dependencias Ruby de Canvas...")
    spinner.start()
    success, out, err = run_command(
        ["docker", "compose", "exec", "-T", "web", "bundle", "check"],
        shell=False,
        cwd=str(CANVAS_DIR),
    )
    if success:
        spinner.stop("[\033[32mOK\033[0m] Dependencias Ruby listas")
        logger.info("bundle check exitoso")
        return True

    spinner.stop("[\033[33mWARN\033[0m] Dependencias Ruby incompletas. Instalando gems...")
    logger.warning("bundle check falló: %s %s", out, err)

    spinner = Spinner("Instalando dependencias Ruby (bundle install, puede tardar varios minutos)...")
    spinner.start()
    install_cmd = (
        "find gems -maxdepth 2 -name Gemfile.lock -delete 2>/dev/null; "
        "bundle config set --local frozen false && bundle install --jobs=2"
    )
    success, out, err = run_command(
        ["docker", "compose", "exec", "-T", "web", "bash", "-c", install_cmd],
        shell=False,
        cwd=str(CANVAS_DIR),
    )
    if success:
        spinner.stop("[\033[32mOK\033[0m] Dependencias Ruby instaladas")
        logger.info("bundle install completado exitosamente")
        return True

    spinner.stop("[\033[31mFAIL\033[0m] Error instalando dependencias Ruby")
    logger.error("bundle install falló: %s %s", out, err)
    return False


def wait_for_canvas_ready(timeout=HEALTHCHECK_TIMEOUT, interval=HEALTHCHECK_INTERVAL):
    logger.info("Esperando health check de Canvas LMS (timeout=%ds, interval=%ds)", timeout, interval)
    spinner = Spinner("Esperando a que Canvas LMS esté listo...")
    spinner.start()
    start = time.time()
    while time.time() - start < timeout:
        success, out, err = run_command(["docker", "compose", "ps", "-q", "web"], shell=False, cwd=str(CANVAS_DIR))
        if success and out.strip():
            spinner.stop("[\033[32mOK\033[0m] Canvas LMS está corriendo")
            logger.info("Canvas LMS está corriendo después de %ds", int(time.time() - start))
            return True
        logger.debug("Canvas LMS aún no está listo, reintentando en %ds...", interval)
        time.sleep(interval)
    spinner.stop(f"[\033[31mFAIL\033[0m] Timeout: Canvas LMS no inició en {timeout}s")
    logger.error("Timeout esperando a Canvas LMS después de %ds", timeout)
    return False
