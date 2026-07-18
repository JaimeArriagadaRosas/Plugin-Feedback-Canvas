#!/usr/bin/env python3
import os
import subprocess
import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from preflight import run_preflight_checks
from provisioner import confirm_installation
from bringup import start_canvas_stack, wait_for_canvas_ready, ensure_ruby_dependencies
from postflight import run_postflight_checks
from logging_config import configure_logging

INSTALL_DIR = Path(__file__).resolve().parent


def main():
    configure_logging()
    logger = logging.getLogger(__name__)
    logger.info("Iniciando verificación de entorno para Canvas LMS local")

    all_ok, missing = run_preflight_checks()

    if not all_ok:
        if not confirm_installation(missing):
            print()
            print("Instalacion cancelada por el usuario.")
            logger.info("Instalación cancelada por el usuario")
            input("Presione Enter para salir...")
            sys.exit(1)

        install_script = INSTALL_DIR / "instalar_dependencias.py"
        env = os.environ.copy()
        for key, value in missing.items():
            env[key.upper()] = "1"

        logger.info("Ejecutando instalador automático: %s", install_script)
        result = subprocess.run(
            [sys.executable, str(install_script)],
            env=env,
        )
        logger.info("Instalador finalizado con código %s", result.returncode)
        
        if result.returncode != 0:
            print()
            print(f"\033[31mLa instalación automática falló con código {result.returncode}.\033[0m")
            print("\033[31mRevise los errores anteriores y corrija el componente fallido.\033[0m")
            sys.exit(result.returncode)
        
        print()
        print("\033[36m" + "=" * 54 + "\033[0m")
        print("   \033[1;37mVERIFICACION POST-INSTALACION\033[0m")
        print("\033[36m" + "=" * 54 + "\033[0m")
        print()
        
        all_ok_after, missing_after = run_preflight_checks()
        if not all_ok_after:
            print()
            print("\033[31m" + "=" * 54 + "\033[0m")
            print("   \033[31mFALLO POST-INSTALACION\033[0m")
            print("\033[31m" + "=" * 54 + "\033[0m")
            print()
            print("Componentes aún faltantes o con problemas:")
            for key in missing_after:
                label = key.replace("missing_", "").replace("_", " ").title()
                print(f"   - {label}")
            print()
            print("\033[31m" + "=" * 54 + "\033[0m")
            print()
            logger.error("Verificación post-instalación fallida: %s", missing_after)
            sys.exit(1)
        
        logger.info("Verificación post-instalación exitosa")
        print("\033[32m" + "=" * 54 + "\033[0m")
        print("   VERIFICACION POST-INSTALACION EXITOSA")
        print("\033[32m" + "=" * 54 + "\033[0m")
        print()

    logger.info("Todos los componentes estáticos están correctamente instalados")
    print("\033[32m" + "=" * 54 + "\033[0m")
    print("   TODOS LOS COMPONENTES ESTAN CORRECTAMENTE INSTALADOS")
    print("\033[32m" + "=" * 54 + "\033[0m\n")

    if not start_canvas_stack():
        logger.error("Fallo al iniciar el stack de Canvas LMS")
        sys.exit(1)

    if not ensure_ruby_dependencies():
        logger.error("Fallo al instalar dependencias Ruby de Canvas LMS")
        sys.exit(1)

    if not wait_for_canvas_ready():
        logger.error("Fallo en health check de Canvas LMS")
        sys.exit(1)

    if not run_postflight_checks():
        logger.error("Fallo en verificación post-arranque")
        sys.exit(1)

    logger.info("Verificación de entorno completada")
    sys.exit(0)


if __name__ == "__main__":
    main()
