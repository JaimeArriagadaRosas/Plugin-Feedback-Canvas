#!/usr/bin/env python3
import os
import sys
import subprocess
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
CANVAS_DIR = BASE_DIR / "canvas-lms-master"

def run_command(cmd, cwd=None):
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return False, "", str(e)

def check_lti_tool():
    print("        Verificando instalacion de herramienta LTI en Canvas...")
    # Buscamos si la herramienta ContextExternalTool Unida existe
    cmd = ["docker", "compose", "exec", "-T", "web", "bundle", "exec", "rails", "runner", "puts ContextExternalTool.where(name: 'Unida').count > 0 ? 'LTI_OK' : 'LTI_MISSING'"]
    success, out, err = run_command(cmd, cwd=CANVAS_DIR)
    
    if success and "LTI_OK" in out:
        print("        OK: Herramienta LTI 'Unida' encontrada en la base de datos de Canvas.")
        return True
    
    print("        ERROR: La herramienta LTI 'Unida' no está instalada.")
    print(f"        Debug: {out} {err}")
    return False

def check_global_js():
    print("        Verificando inyeccion de script JS...")
    cmd = ["docker", "compose", "exec", "-T", "web", "bundle", "exec", "rails", "runner", "puts Account.default.settings[:global_javascript].present? ? 'JS_OK' : 'JS_MISSING'"]
    success, out, err = run_command(cmd, cwd=CANVAS_DIR)
    
    if success and "JS_OK" in out:
        print("        OK: Script JS correctamente inyectado en Account.default.")
        return True
    
    print("        ERROR: No se encontró el script JS en la configuración global de Canvas.")
    print(f"        Debug: {out} {err}")
    return False

def main():
    print("        Conectando con la base de datos de Canvas...")
    
    # Comprobar si docker está corriendo Canvas
    success, out, err = run_command(["docker", "compose", "ps", "-q", "web"], cwd=CANVAS_DIR)
    if not success or not out.strip():
        print("        ERROR: El contenedor 'web' de Canvas no está corriendo. No se puede verificar la BD.")
        sys.exit(1)

    all_ok = True
    if not check_lti_tool():
        all_ok = False
    
    if not check_global_js():
        all_ok = False
        
    if all_ok:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
