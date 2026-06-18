#!/usr/bin/env python3
import os
import sys
import subprocess
import platform
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
CANVAS_DIR = BASE_DIR / "canvas-lms-master"
PLUGIN_DIR = BASE_DIR / "Plugin Feedback"
INSTALL_DIR = Path(__file__).resolve().parent


def run_command(cmd, shell=False):
    try:
        result = subprocess.run(
            cmd,
            shell=shell,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return False, "", str(e)


def check_docker():
    success, out, err = run_command(["docker", "--version"])
    if success:
        print(f"        OK: {out}")
        return True, {}
    print("        ERROR: Docker no esta instalado o no esta en el PATH.")
    return False, {"missing_docker": True}


def check_docker_compose():
    success, out, err = run_command(["docker", "compose", "version"])
    if success:
        print(f"        OK: {out}")
        return True, {}
    print("        ERROR: Docker Compose no esta disponible.")
    return False, {"missing_compose": True}


def check_canvas_clone():
    if (CANVAS_DIR / "docker-compose.yml").exists():
        print(f"        OK: Clon encontrado en {CANVAS_DIR}")
        return True, {}
    print(f"        ERROR: No se encontro el clon de Canvas LMS en {CANVAS_DIR}")
    return False, {"missing_canvas_clone": True}


def check_node():
    success, out, err = run_command(["node", "--version"])
    if success:
        print(f"        OK: {out}")
        return True, {}
    print("        ERROR: Node.js no esta instalado o no esta en el PATH.")
    return False, {"missing_node": True}


def check_npm():
    is_win = platform.system() == "Windows"
    success, out, err = run_command(["npm", "--version"] if not is_win else "npm --version", shell=is_win)
    if success:
        print(f"        OK: {out}")
        return True, {}
    print("        ERROR: NPM no esta instalado o no esta en el PATH.")
    return False, {"missing_npm": True}


def confirm_installation(missing):
    print()
    print("=" * 54)
    print(f"   SE DETECTARON {len(missing)} PROBLEMA(S)")
    print("=" * 54)
    print()
    print("Componentes faltantes o con problemas:")
    for key in missing:
        label = key.replace("missing_", "").replace("_", " ").title()
        print(f"   - {label}")
    print()
    resp = input("Desea proceder con la instalacion automatica de los componentes faltantes? (S/N) [N]: ").strip().upper()
    return resp == "S"


def main():
    print("=" * 54)
    print("   VERIFICACION DE COMPONENTES - CANVAS LMS LOCAL")
    print("=" * 54)
    print()

    checks = [
        ("Docker", check_docker),
        ("Docker Compose", check_docker_compose),
        ("Canvas LMS clone", check_canvas_clone),
        ("Node.js", check_node),
        ("NPM", check_npm),
    ]

    missing = {}
    all_ok = True
    for idx, (name, fn) in enumerate(checks, start=1):
        print(f"[{idx}/5] Verificando {name}...")
        ok, details = fn()
        if not ok:
            all_ok = False
            missing.update(details)
        print()

    if all_ok:
        print("=" * 54)
        print("   TODOS LOS COMPONENTES ESTAN CORRECTAMENTE INSTALADOS")
        print("=" * 54)
        print()
        print("Verificando contenedores de Canvas LMS...")
        success, out, err = run_command(["docker", "compose", "ps"], shell=False)
        if success and out:
            print(out)
            
        print()
        print("[6/6] Verificando Base de datos y Plugin en Canvas...")
        plugin_script = INSTALL_DIR / "verificar_plugin.py"
        plugin_result = subprocess.run([sys.executable, str(plugin_script)])
        if plugin_result.returncode != 0:
            print("Advertencia: La verificación del plugin LTI falló. Puede que Canvas aún esté iniciando.")
            
        sys.exit(0)

    if not confirm_installation(missing):
        print()
        print("Instalacion cancelada por el usuario.")
        input("Presione Enter para salir...")
        sys.exit(1)

    install_script = INSTALL_DIR / "instalar_dependencias.py"
    env = os.environ.copy()
    # Pasar claves de componentes faltantes por variable de entorno
    for key, value in missing.items():
        env[key.upper()] = "1"

    result = subprocess.run(
        [sys.executable, str(install_script)],
        env=env,
    )
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
