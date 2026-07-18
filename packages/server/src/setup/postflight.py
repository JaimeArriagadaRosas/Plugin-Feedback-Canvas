import logging
import subprocess
import sys

from constants import INSTALL_DIR
from spinner import Spinner
from verificar_plugin import check_lti_tool
from activar_boton_cursos import activar_boton_cursos

logger = logging.getLogger(__name__)


def run_postflight_checks():
    logger.info("Iniciando verificación post-arranque de la Universidad y el plugin LTI")

    spinner = Spinner("Verificando datos base de la institución (Cursos, Usuarios)...")
    spinner.start()
    datos_script = INSTALL_DIR / "verificar_datos.py"

    datos_result = subprocess.run([sys.executable, str(datos_script)])

    if datos_result.returncode != 0:
        spinner.stop("[\033[33mWARN\033[0m] Faltan los datos base de la Universidad. Intentando inyectar datos...")
        logger.warning("Faltan datos base (returncode=%s). Ejecutando poblador...", datos_result.returncode)

        spinner = Spinner("Inyectando datos base de la Universidad...")
        spinner.start()
        poblador_script = INSTALL_DIR / "poblar_datos_prueba.py"
        poblador_result = subprocess.run([sys.executable, str(poblador_script)])

        if poblador_result.returncode != 0:
            spinner.stop("[\033[31mFAIL\033[0m] No se pudieron inyectar los datos base automáticamente.")
            logger.error("No se pudieron inyectar los datos base automáticamente.")
            return False

        spinner.stop("")
        spinner = Spinner("Re-verificando datos base en Canvas...")
        spinner.start()
        datos_result2 = subprocess.run([sys.executable, str(datos_script)])
        if datos_result2.returncode != 0:
            spinner.stop("[\033[31mFAIL\033[0m] La verificación final de datos falló.")
            return False

        spinner.stop("[\033[32mOK\033[0m] Datos base inyectados correctamente")
        _sync_teacher_token_if_needed()
    else:
        spinner.stop("[\033[32mOK\033[0m] Datos base de la Universidad validados")
        # Sincronizar el token del profesor aunque los datos ya existan,
        # porque el token de Canvas cambia en cada instalación/reinicio de BD.
        _sync_teacher_token_if_needed()

    spinner = Spinner("Verificando instalación del Plugin LTI (Unida)...")
    spinner.start()
    plugin_script = INSTALL_DIR / "verificar_plugin.py"
    plugin_result = subprocess.run([sys.executable, str(plugin_script)])

    if plugin_result.returncode != 0:
        spinner.stop("[\033[33mWARN\033[0m] La instalación del LTI se delegará al orquestador principal (Node.js).")
    else:
        spinner.stop("[\033[32mOK\033[0m] Plugin LTI (Unida) validado e instalado")

    spinner = Spinner("Activando visibilidad por defecto del botón en todos los cursos...")
    spinner.start()
    if not activar_boton_cursos():
        spinner.stop("[\033[33mWARN\033[0m] Ocurrió un problema activando el botón en los cursos. Hágalo manualmente desde Canvas.")
    else:
        spinner.stop("[\033[32mOK\033[0m] Botón LTI activado en todos los cursos.")

    logger.info("Verificación post-arranque exitosa")
    return True


def _sync_teacher_token_if_needed():
    """
    En re-arranques, los datos ya existen pero el token del profesor puede haber
    cambiado (ej. si se reinició la BD de Canvas). Se extrae el token actual del
    profesor desde el contenedor y se actualiza el .env.
    """
    import json
    from constants import CANVAS_DIR, PLUGIN_DIR

    env_file = PLUGIN_DIR / ".env"
    logger.info("Sincronizando CANVAS_ACCESS_TOKEN con el token actual del profesor en Canvas...")

    try:
        result = subprocess.run(
            ["docker", "compose", "exec", "-T", "web", "cat", "/usr/src/app/tmp/perfiles_data.json"],
            capture_output=True, text=True, encoding="utf-8", cwd=str(CANVAS_DIR)
        )
        if result.returncode != 0 or not result.stdout.strip():
            logger.warning("perfiles_data.json no encontrado en el contenedor. Se omite la sincronización del token.")
            return

        perfiles = json.loads(result.stdout)
        teacher = next(
            (u for u in perfiles.get("usuarios", []) if u.get("rol") == "teacher"),
            None
        )
        if not teacher or not teacher.get("token"):
            logger.warning("No se encontró token del profesor en perfiles_data.json")
            return

        token = teacher["token"]
        content = env_file.read_text(encoding="utf-8") if env_file.exists() else ""
        lines = content.splitlines()
        updated = False
        for i, line in enumerate(lines):
            if line.startswith("CANVAS_ACCESS_TOKEN="):
                if lines[i] == f"CANVAS_ACCESS_TOKEN={token}":
                    logger.info("CANVAS_ACCESS_TOKEN ya está actualizado. No se requiere cambio.")
                    return
                lines[i] = f"CANVAS_ACCESS_TOKEN={token}"
                updated = True
                break
        if not updated:
            lines.append(f"CANVAS_ACCESS_TOKEN={token}")
        env_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        logger.info("CANVAS_ACCESS_TOKEN actualizado en .env desde perfiles_data.json")
        print("[\033[32mOK\033[0m] CANVAS_ACCESS_TOKEN sincronizado desde Canvas.")

    except Exception as e:
        logger.warning("No se pudo sincronizar el token del profesor: %s", e)