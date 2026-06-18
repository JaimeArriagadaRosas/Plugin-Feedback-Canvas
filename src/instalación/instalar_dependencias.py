#!/usr/bin/env python3
import os
import sys
import subprocess
import platform
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
CANVAS_DIR = BASE_DIR / "canvas-lms-master"
INSTALL_DIR = Path(__file__).resolve().parent


def run_command(cmd, shell=False, cwd=None):
    try:
        result = subprocess.run(
            cmd,
            shell=shell,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return False, "", str(e)


def prompt_yes_no(message, default=False):
    default_label = "S" if default else "N"
    while True:
        resp = input(f"{message} (S/N) [{default_label}]: ").strip().upper()
        if resp in ("S", "N", ""):
            return resp == "S" or (default and resp == "")


def install_docker_windows():
    print("Descargando Docker Desktop Installer...")
    url = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
    dest = Path(os.environ.get("TEMP", "/tmp")) / "DockerDesktopInstaller.exe"
    try:
        import urllib.request
        urllib.request.urlretrieve(url, dest)
    except Exception as e:
        print(f"ERROR: No se pudo descargar Docker Desktop: {e}")
        return False
    print("Ejecutando instalador de Docker Desktop...")
    print("Por favor, siga las instrucciones en pantalla.")
    try:
        os.startfile(str(dest))
    except AttributeError:
        subprocess.Popen([str(dest)], shell=True)
    print()
    print("IMPORTANTE: Debe reiniciar su equipo despues de que Docker termine de instalarse.")
    print("Una vez reiniciado, ejecute nuevamente este script.")
    return True


def install_docker_mac():
    print("Instalando Docker Desktop para macOS...")
    print("Descargando desde https://www.docker.com/products/docker-desktop/")
    url = "https://desktop.docker.com/mac/main/amd64/Docker.dmg"
    dest = Path("/tmp") / "Docker.dmg"
    try:
        import urllib.request
        urllib.request.urlretrieve(url, dest)
    except Exception as e:
        print(f"ERROR: No se pudo descargar Docker Desktop: {e}")
        return False
    print("Montando imagen DMG...")
    ok, _, _ = run_command(["hdiutil", "attach", str(dest)])
    if not ok:
        print("ERROR: No se pudo montar el DMG.")
        return False
    print("Copiando Docker a Aplicaciones...")
    ok, _, _ = run_command(["cp", "-R", "/Volumes/Docker/Docker.app", "/Applications/"])
    if not ok:
        print("ERROR: No se pudo copiar Docker.app a /Applications")
        return False
    run_command(["hdiutil", "detach", "/Volumes/Docker"])
    print("Docker Desktop instalado. Abrelo desde Aplicaciones para finalizar la configuracion.")
    return True


def install_docker_linux():
    print("Instalando Docker y Docker Compose en Linux...")
    ok, _, _ = run_command(["sudo", "apt-get", "update"])
    if not ok:
        print("ERROR: No se pudo actualizar los paquetes.")
        return False
    ok, _, _ = run_command(["sudo", "apt-get", "install", "-y", "docker.io", "docker-compose"])
    if not ok:
        print("ERROR: No se pudo instalar Docker.")
        return False
    ok, _, _ = run_command(["sudo", "systemctl", "enable", "--now", "docker"])
    if not ok:
        print("ERROR: No se pudo habilitar el servicio Docker.")
        return False
    print("Docker instalado correctamente en Linux.")
    return True


def install_docker():
    system = platform.system()
    if system == "Windows":
        return install_docker_windows()
    elif system == "Darwin":
        return install_docker_mac()
    elif system == "Linux":
        return install_docker_linux()
    else:
        print(f"Sistema operativo no soportado para instalacion automatica de Docker: {system}")
        return False


def install_docker_compose_standalone():
    print("Instalando Docker Compose standalone...")
    system = platform.system()
    arch = platform.machine()
    if system == "Windows" and arch in ("AMD64", "x86_64"):
        url = "https://github.com/docker/compose/releases/latest/download/docker-compose-Windows-x86_64.exe"
        dest = Path("C:\\Windows\\System32\\docker-compose.exe")
    elif system == "Linux" and arch in ("x86_64",):
        url = "https://github.com/docker/compose/releases/latest/download/docker-compose-Linux-x86_64"
        dest = Path("/usr/local/bin/docker-compose")
    elif system == "Darwin" and arch in ("arm64", "x86_64"):
        url = f"https://github.com/docker/compose/releases/latest/download/docker-compose-{system}-{arch}"
        dest = Path("/usr/local/bin/docker-compose")
    else:
        print(f"Arquitectura no soportada para Docker Compose standalone: {system} {arch}")
        return False
    print(f"Descargando desde {url}")
    try:
        import urllib.request
        urllib.request.urlretrieve(url, dest)
        if system != "Windows":
            os.chmod(dest, 0o755)
    except Exception as e:
        print(f"ERROR: No se pudo descargar Docker Compose: {e}")
        return False
    print("Docker Compose instalado correctamente.")
    return True


def clone_canvas_lms():
    print("Clonando repositorio Canvas LMS...")
    print(f"Destino: {CANVAS_DIR}")
    if CANVAS_DIR.exists():
        print("La carpeta canvas-lms-master ya existe. Se omitira la clonacion.")
        return True
    ok, out, err = run_command(["git", "clone", "--depth", "1", "-b", "prod", "https://github.com/instructure/canvas-lms.git", str(CANVAS_DIR)])
    if not ok:
        print(f"ERROR: No se pudo clonar Canvas LMS. {err}")
        return False
    print("Canvas LMS clonado correctamente.")
    env_file = CANVAS_DIR / ".env"
    env_example = CANVAS_DIR / ".env.example"
    if env_example.exists():
        print("Copiando .env.example a .env...")
        env_file.write_text(env_example.read_text(), encoding="utf-8")
    else:
        print("Creando archivo .env basico...")
        env_file.write_text(
            "POSTGRES_PASSWORD=sekret\n"
            "CANVAS_LMS_ADMIN_EMAIL=admin@example.com\n"
            "CANVAS_LMS_ADMIN_PASSWORD=password123\n"
            "CANVAS_LMS_HOST=localhost:8080\n",
            encoding="utf-8",
        )
    print("Iniciando servicios de Canvas LMS (Docker Compose)...")
    ok, out, err = run_command(["docker", "compose", "up", "-d"], shell=False, cwd=str(CANVAS_DIR))
    if not ok:
        print(f"ERROR: No se pudo iniciar Docker Compose. {err}")
        return False
    print("Servicios de Canvas LMS iniciados.")
    print("NOTA: La primera inicializacion de la base de datos puede tardar entre 10 y 30 minutos.")
    return True


def install_nodejs():
    print("Instalando Node.js LTS...")
    system = platform.system()
    arch = platform.machine()
    if system == "Windows" and arch in ("AMD64", "x86_64"):
        url = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
        dest = Path(os.environ.get("TEMP", "/tmp")) / "nodejs_installer.msi"
    elif system == "Darwin" and arch in ("arm64",):
        url = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-darwin-arm64.tar.gz"
        dest = Path("/tmp") / "node-v20.11.1-darwin-arm64.tar.gz"
    elif system == "Darwin" and arch in ("x86_64",):
        url = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-darwin-x64.tar.gz"
        dest = Path("/tmp") / "node-v20.11.1-darwin-x64.tar.gz"
    elif system == "Linux" and arch in ("x86_64",):
        url = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.xz"
        dest = Path("/tmp") / "node-v20.11.1-linux-x64.tar.xz"
    else:
        print(f"Arquitectura no soportada para instalacion automatica de Node.js: {system} {arch}")
        return False
    print(f"Descargando desde {url}")
    try:
        import urllib.request
        urllib.request.urlretrieve(url, dest)
    except Exception as e:
        print(f"ERROR: No se pudo descargar Node.js: {e}")
        return False
    if system == "Windows":
        print("Ejecutando instalador de Node.js...")
        subprocess.Popen([str(dest)], shell=True)
        print("NOTA: Debe seguir las instrucciones en pantalla y reiniciar la consola despues.")
        return True
    else:
        extract_dir = Path("/usr/local/lib/nodejs")
        extract_dir.mkdir(parents=True, exist_ok=True)
        ok, _, _ = run_command(["tar", "-xJf" if dest.suffix == ".xz" else "-xzf", str(dest), "-C", str(extract_dir)])
        if not ok:
            print("ERROR: No se pudo extraer Node.js.")
            return False
        print("Node.js extraido en /usr/local/lib/nodejs")
        print("NOTA: Agregue /usr/local/lib/nodejs/node-v20.11.1/bin a su PATH.")
        return True


def main():
    print("=" * 54)
    print("   INSTALACION AUTOMATICA DE DEPENDENCIAS")
    print("=" * 54)
    print()

    missing_docker = os.environ.get("MISSING_DOCKER") == "1"
    missing_compose = os.environ.get("MISSING_COMPOSE") == "1"
    missing_canvas_clone = os.environ.get("MISSING_CANVAS_CLONE") == "1"
    missing_node = os.environ.get("MISSING_NODE") == "1"
    missing_npm = os.environ.get("MISSING_NPM") == "1"

    processed = []

    if missing_docker:
        print("[1/5] Instalando Docker...")
        print("=" * 54)
        print()
        print("       Docker Desktop se descargara e instalara.")
        print("       Esto puede tardar varios minutos dependiendo de su conexion.")
        print()
        print("       NOTA: Se requiere reiniciar el equipo despues de la instalacion.")
        print()
        if prompt_yes_no("Desea continuar con la instalacion de Docker?", default=False):
            if install_docker():
                processed.append("Docker")
        else:
            print("Instalacion de Docker cancelada.")
        print()

    if missing_compose:
        print("[2/5] Instalando Docker Compose...")
        print("Docker Compose generalmente se incluye con Docker Desktop.")
        if prompt_yes_no("Desea instalar Docker Compose standalone?", default=False):
            if install_docker_compose_standalone():
                processed.append("Docker Compose")
        else:
            print("Instalacion de Docker Compose cancelada.")
        print()

    if missing_canvas_clone:
        print("[3/5] Clonando repositorio Canvas LMS...")
        print()
        print(f"       Esto clonara el repositorio de Canvas LMS en:\n       {CANVAS_DIR}")
        print()
        print("       Esto puede tardar varios minutos dependiendo de su conexion.")
        print()
        if prompt_yes_no("Desea clonar Canvas LMS?", default=False):
            if clone_canvas_lms():
                processed.append("Canvas LMS")
        else:
            print("Clonacion de Canvas LMS cancelada.")
        print()

    if missing_node:
        print("[4/5] Instalando Node.js...")
        if prompt_yes_no("Desea instalar Node.js LTS?", default=False):
            if install_nodejs():
                processed.append("Node.js")
        else:
            print("Instalacion de Node.js cancelada.")
        print()

    if missing_npm:
        print("[5/5] NPM deberia haberse instalado junto con Node.js...")
        if prompt_yes_no("Desea intentar instalar NPM?", default=False):
            processed.append("NPM (verificar instalacion de Node.js)")
        else:
            print("Instalacion de NPM cancelada.")
        print()

    print("=" * 54)
    print("   RESUMEN DE INSTALACION")
    print("=" * 54)
    print()
    if processed:
        print("Componentes procesados:")
        for item in processed:
            print(f"   - {item}")
    else:
        print("No se proceso ningun componente.")
    print()
    print("=" * 54)
    input("Presione Enter para continuar...")


if __name__ == "__main__":
    main()
