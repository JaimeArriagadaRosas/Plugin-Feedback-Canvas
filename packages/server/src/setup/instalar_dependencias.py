#!/usr/bin/env python3
import os
import sys
import subprocess
import platform
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import poblar_datos_prueba
import unittest
import logging
from logging_config import configure_logging
from spinner import Spinner
from diagnostics import analyze_log_and_diagnose, print_diagnosis_box
from runner import run_command

PLUGIN_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent
WORKSPACE_DIR = PLUGIN_DIR.parent
CANVAS_DIR = WORKSPACE_DIR / "canvas-lms-master"
INSTALL_DIR = Path(__file__).resolve().parent



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


def is_docker_installed():
    ok, _, _ = run_command(["docker", "--version"])
    return ok


def is_docker_daemon_running():
    ok, _, _ = run_command(["docker", "info"])
    return ok


def docker_desktop_exe_path():
    program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
    candidates = [
        Path(program_files) / "Docker" / "Docker" / "Docker Desktop.exe",
        Path(r"C:\Program Files\Docker\Docker\Docker Desktop.exe"),
    ]
    local_app = os.environ.get("LOCALAPPDATA")
    if local_app:
        candidates.append(Path(local_app) / "Docker" / "Docker Desktop.exe")
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def open_docker_desktop():
    system = platform.system()
    if system == "Windows":
        exe = docker_desktop_exe_path()
        if exe:
            try:
                os.startfile(str(exe))
                return True
            except AttributeError:
                pass
            except Exception:
                pass
            try:
                subprocess.Popen([str(exe)], shell=True)
                return True
            except Exception:
                pass
        try:
            subprocess.Popen(["cmd", "/c", "start", "", "Docker Desktop"], shell=False)
            return True
        except Exception:
            return False
    elif system == "Darwin":
        try:
            subprocess.Popen(["open", "-a", "Docker"])
            return True
        except Exception:
            return False
    elif system == "Linux":
        for cmd in (["systemctl", "--user", "start", "docker-desktop"],
                    ["sudo", "systemctl", "start", "docker"]):
            try:
                subprocess.Popen(cmd)
                return True
            except Exception:
                continue
        return False
    return False


def wait_for_docker_daemon(timeout=None, interval=5, warn_after=30):
    spinner = Spinner("Esperando a que el daemon de Docker esté disponible...")
    spinner.start()
    start = time.time()
    warned = False
    while True:
        if is_docker_daemon_running():
            elapsed = int(time.time() - start)
            spinner.stop(f"[\033[32mOK\033[0m] Docker daemon disponible (tras {elapsed}s)")
            return True
        elapsed = int(time.time() - start)
        if not warned and elapsed >= warn_after:
            warned = True
            spinner.stop(f"\033[33m[!] El daemon de Docker tarda más de {warn_after}s en iniciar. Sigo esperando...\033[0m")
            spinner = Spinner("Esperando a que el daemon de Docker esté disponible...")
            spinner.start()
        if timeout is not None and elapsed >= timeout:
            spinner.stop("[\033[31mFAIL\033[0m] Timeout: el daemon de Docker no inició")
            return False
        time.sleep(interval)


def handle_docker_daemon_down():
    logger = logging.getLogger(__name__)
    opened = open_docker_desktop()
    if opened:
        logger.info("Docker Desktop abierto; esperando a que el daemon inicie")
        print("\033[33mDocker Desktop se está iniciando. Esto puede tardar entre 30 segundos y 2 minutos.\033[0m")
    else:
        logger.warning("No se pudo abrir Docker Desktop automáticamente")
        print("\033[33mAviso: No se pudo abrir Docker Desktop. Ábralo manualmente y espere a que el daemon inicie.\033[0m")
    return wait_for_docker_daemon(timeout=600, interval=5, warn_after=30)


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
    ok, out, err = run_command(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--depth", "1", "-b", "prod", "https://github.com/instructure/canvas-lms.git", str(CANVAS_DIR)])

    if not ok:
        print("Buscando 'git' en la instalación local de GitHub Desktop...")
        import glob
        git_path = None
        user_profile = os.environ.get("USERPROFILE")
        if user_profile:
            pattern = os.path.join(user_profile, "AppData", "Local", "GitHubDesktop", "app-*", "resources", "app", "git", "cmd", "git.exe")
            matches = glob.glob(pattern)
            if matches:
                git_path = sorted(matches)[-1]
        
        if git_path:
            print(f"Ejecutando clone usando: {git_path}")
            ok, out, err = run_command([git_path, "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--depth", "1", "-b", "prod", "https://github.com/instructure/canvas-lms.git", str(CANVAS_DIR)])
    
    if not ok:
        print(f"ERROR: No se pudo clonar Canvas LMS con git. {err}")
        print("Intentando descargar el código fuente como ZIP (esto puede tardar unos minutos)...")
        try:
            import urllib.request
            import zipfile
            import shutil
            zip_url = "https://github.com/instructure/canvas-lms/archive/refs/heads/prod.zip"
            zip_dest = CANVAS_DIR.parent / "canvas-lms-prod.zip"
            urllib.request.urlretrieve(zip_url, zip_dest)
            with zipfile.ZipFile(zip_dest, 'r') as zip_ref:
                zip_ref.extractall(CANVAS_DIR.parent)
            zip_dest.unlink()
            extracted_dir = CANVAS_DIR.parent / "canvas-lms-prod"
            if extracted_dir.exists():
                if CANVAS_DIR.exists():
                    shutil.rmtree(CANVAS_DIR)
                extracted_dir.rename(CANVAS_DIR)
            else:
                return False
        except Exception as e:
            print(f"ERROR: No se pudo descargar/extraer Canvas LMS como ZIP: {e}")
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
    print("Aplicando optimizaciones de recursos (docker-compose.override.yml)...")
    override_file = CANVAS_DIR / "docker-compose.override.yml"
    if not override_file.exists():
        override_file.write_text(
            "services:\n"
            "  jobs:\n"
            "    mem_limit: 2g\n"
            "    cpus: '1'\n"
            "    volumes:\n"
            "      - .:/usr/src/app\n"
            "      - canvas-bundle-gems:/home/docker/.gem\n"
            "  web:\n"
            "    mem_limit: 4g\n"
            "    cpus: '2'\n"
            "    ports:\n"
            "      - \"8080:80\"\n"
            "    environment:\n"
            "      RSPACK: 'true'\n"
            "      CANVAS_LTI_COURSE_NAVIGATION: 'true'\n"
            "    volumes:\n"
            "      - .:/usr/src/app\n"
            "      - canvas-bundle-gems:/home/docker/.gem\n"
            "\n"
            "volumes:\n"
            "  canvas-bundle-gems:\n",
            encoding="utf-8",
            newline="\n"
        )
    else:
        print("El archivo docker-compose.override.yml ya existe. Omitiendo optimizaciones automáticas.")

    print("Corrigiendo CRLF en scripts de inicializacion de BD...")
    create_dbs_sh = CANVAS_DIR / "docker-compose" / "postgres" / "create-dbs.sh"
    if create_dbs_sh.exists():
        content = create_dbs_sh.read_bytes()
        create_dbs_sh.write_bytes(content.replace(b'\r\n', b'\n'))

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


def setup_canvas_assets():
    print("\n\033[36m=========================================================\033[0m")
    print("   \033[1;37mCONFIGURANDO DEPENDENCIAS Y ASSETS DE CANVAS LMS\033[0m")
    print("\033[36m=========================================================\033[0m\n")

    print("Configurando archivos de ejemplo esenciales (*.yml.example -> *.yml)...")
    import shutil
    config_dir = CANVAS_DIR / "config"
    essential_files = [
        "database.yml", "domain.yml", "security.yml",
        "dynamic_settings.yml", "cache_store.yml", "redis.yml",
        "outgoing_mail.yml", "delayed_jobs.yml"
    ]
    if config_dir.exists():
        for name in essential_files:
            example_file = config_dir / f"{name}.example"
            target_file = config_dir / name
            if example_file.exists() and not target_file.exists():
                shutil.copy2(example_file, target_file)

        # Eliminar archivos conflictivos copiados por error
        for name in ["consul.yml", "vault.yml", "dynamodb.yml"]:
            bad_file = config_dir / name
            if bad_file.exists():
                try:
                    bad_file.unlink()
                except Exception:
                    pass

        # Siempre sobreescribir database.yml con credenciales correctas para Docker.
        # El archivo .example usa 'username: canvas' / 'password: your_password' y
        # no tiene 'host:', lo que hace fallar db:create porque el contenedor web
        # no puede conectar al servicio postgres por socket local.
        # Las credenciales correctas vienen de docker-compose.yml: usuario=postgres,
        # password=sekret, host=postgres (nombre del servicio Docker).
        db_yml = config_dir / "database.yml"
        db_yml.write_text(
            "# Generado automaticamente por el instalador - NO editar manualmente\n"
            "# Las credenciales deben coincidir con docker-compose.yml\n"
            "development:\n"
            "  adapter: postgresql\n"
            "  encoding: utf8\n"
            "  database: canvas_development\n"
            "  host: postgres\n"
            "  username: postgres\n"
            "  password: sekret\n"
            "  timeout: 5000\n"
            "  secondary:\n"
            "    replica: true\n"
            "    username: postgres\n"
            "    password: sekret\n"
            "    host: postgres\n"
            "\n"
            "test:\n"
            "  adapter: postgresql\n"
            "  encoding: utf8\n"
            "  database: canvas_test\n"
            "  host: postgres\n"
            "  username: postgres\n"
            "  password: sekret\n"
            "  timeout: 5000\n"
            "\n"
            "production:\n"
            "  adapter: postgresql\n"
            "  encoding: utf8\n"
            "  database: canvas_production\n"
            "  host: postgres\n"
            "  username: postgres\n"
            "  password: sekret\n"
            "  timeout: 5000\n",
            encoding="utf-8",
            newline="\n"
        )
        print("[\033[32mOK\033[0m] database.yml configurado correctamente para Docker.")

        # domain.yml por defecto usa localhost:3000 (puma-dev). En Docker Canvas
        # escucha en 8080; si no se corrige, canvas_domain en lti_message_hint
        # apunta al plugin y el flujo OIDC falla en /api/lti/authorize.
        domain_yml = config_dir / "domain.yml"
        domain_yml.write_text(
            "# Generado automaticamente por el instalador - NO editar manualmente\n"
            "test:\n"
            "  domain: localhost\n"
            "\n"
            "development:\n"
            "  domain: \"localhost:8080\"\n"
            "\n"
            "production:\n"
            "  domain: \"canvas.example.com\"\n"
            "  ssl: true\n",
            encoding="utf-8",
            newline="\n"
        )
        print("[\033[32mOK\033[0m] domain.yml configurado para Canvas Local (localhost:8080).")

        # Si el contenedor web ya está corriendo, un simple `up -d` NO recarga
        # domain.yml (Rails lo lee al arrancar y HostUrl.default_host lo cachea),
        # ni tampoco toma la nueva config de Redis/cache_store ni la var
        # REDIS_URL del override. Reiniciamos/recreamos para aplicar:
        #  - domain.yml (localhost:8080) -> evita que canvas_domain apunte al
        #    plugin (localhost:3000), causa de rebotes en el flujo OIDC.
        #  - redis.yml + cache_store.yml + REDIS_URL -> REQUIRED para que Canvas
        #    cachee el launch LTI 1.3 en Redis; sin esto cache_launch devuelve
        #    nil y el flujo falla con "launch_no_longer_valid".
        try:
            # Asegurar que el servicio redis (nuevo) esté arriba.
            run_command(["docker", "compose", "up", "-d", "redis"], shell=False, cwd=str(CANVAS_DIR))
            running, out, _ = run_command(
                ["docker", "compose", "ps", "-q", "web"], shell=False, cwd=str(CANVAS_DIR)
            )
            if running and out.strip():
                print("Recreando servicio web para aplicar domain.yml y Redis...")
                run_command(
                    ["docker", "compose", "up", "-d", "--force-recreate", "web"],
                    shell=False, cwd=str(CANVAS_DIR)
                )
                print("[\033[32mOK\033[0m] Servicio web recreado con dominio localhost:8080 y Redis habilitado.")
            else:
                # Web no corría aún: el `up -d` general ya lo levantará con la
                # config correcta (redis.yml/cache_store.yml/REDIS_URL).
                run_command(["docker", "compose", "up", "-d", "web"], shell=False, cwd=str(CANVAS_DIR))
        except Exception as e:
            print(f"AVISO: no se pudo recrear el servicio web tras domain.yml: {e}")

    log_dir = PLUGIN_DIR / "logs"
    log_dir.mkdir(exist_ok=True)
    log_file_path = log_dir / "canvas_build.log"

    def run_logged(cmd, spinner, fail_msg, success_msg, cwd=str(CANVAS_DIR), warn_after=60, max_retries=0, retry_delay=10):
        start = time.time()
        attempt = 0
        while True:
            try:
                with open(log_file_path, "a", encoding="utf-8") as f:
                    f.write(f"\n--- Ejecutando: {' '.join(cmd)} ---\n")
                    f.flush()
                    process = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
                    for line in iter(process.stdout.readline, ""):
                        f.write(line)
                        f.flush()
                        clean_line = line.strip()
                        if clean_line:
                            trunc = clean_line if len(clean_line) < 60 else clean_line[:57] + "..."
                            spinner.set_suffix(f" > \033[90m{trunc}\033[0m")
                    process.wait()
                    if process.returncode != 0:
                        raise subprocess.CalledProcessError(process.returncode, cmd)
                elapsed = int(time.time() - start)
                spinner.set_suffix("")
                spinner.stop(success_msg + f" ({elapsed}s)")
                warn_if_slow(success_msg, elapsed, warn_after)
                return True, elapsed
            except subprocess.CalledProcessError as e:
                attempt += 1
                elapsed = int(time.time() - start)
                spinner.set_suffix("")
                
                diagnosis = analyze_log_and_diagnose(log_file_path)
                
                if attempt <= max_retries:
                    if diagnosis and diagnosis["type"] == "NETWORK_ERROR":
                        retry_msg = f"\033[33m[!] Inestabilidad de internet detectada. Reintentando ({attempt}/{max_retries}) en {retry_delay}s...\033[0m"
                    else:
                        retry_msg = f"\033[33m[!] Fallo detectado. Reintentando ({attempt}/{max_retries}) en {retry_delay}s...\033[0m"
                    print(retry_msg)
                    time.sleep(retry_delay)
                    continue
                spinner.stop(fail_msg + f". Código {e.returncode} ({elapsed}s)")
                
                if diagnosis:
                    print_diagnosis_box(diagnosis)
                else:
                    print("\n\033[31m[!] Detalle del Error (Últimas líneas del log):\033[0m")
                    try:
                        with open(log_file_path, "r", encoding="utf-8") as f:
                            lines = f.readlines()
                            for line in lines[-25:]:
                                print(f"  {line.rstrip()}")
                    except Exception:
                        pass
                
                print(f"\n\033[33mRevisa el archivo completo en: {log_file_path}\033[0m\n")
                return False, elapsed

    def warn_if_slow(label, elapsed, warn_after):
        if elapsed >= warn_after:
            print(f"\033[33m[!] {label} tardó {elapsed}s (más de {warn_after}s)\033[0m")

    spinner = Spinner("Verificando conexión con el daemon de Docker...")
    spinner.start()
    ok, _ = run_logged(["docker", "info"], spinner, "[\033[31mFAIL\033[0m] Docker no responde. ¡Asegúrese de que Docker Desktop esté abierto!", "[\033[32mOK\033[0m] Docker en ejecución", warn_after=30, max_retries=10, retry_delay=10)
    if not ok:
        return False

    spinner = Spinner("Iniciando contenedores (esto descargará imágenes y tomará tiempo)...")
    spinner.start()
    ok, _ = run_logged(["docker", "compose", "up", "-d"], spinner, "[\033[31mFAIL\033[0m] Falló el inicio de los contenedores", "[\033[32mOK\033[0m] Contenedores iniciados", warn_after=120, max_retries=5, retry_delay=10)
    if not ok:
        return False

    spinner = Spinner("Limpiando lockfiles de gems hijos (evita conflictos de versiones)...")
    spinner.start()
    run_logged(
        ["docker", "compose", "exec", "-T", "web", "bash", "-c",
         "find gems -maxdepth 2 -name Gemfile.lock -delete 2>/dev/null; true"],
        spinner,
        "[\033[33mWARN\033[0m] No se pudieron limpiar los lockfiles hijos",
        "[\033[32mOK\033[0m] Lockfiles hijos limpiados",
        warn_after=60)

    spinner = Spinner("Instalando dependencias de Ruby (bundle install)...")
    spinner.start()
    ok, _ = run_logged(["docker", "compose", "exec", "-T", "web", "bash", "-c", "bundle config set --local frozen false && bundle install --jobs=2"], spinner, "[\033[31mFAIL\033[0m] Error en dependencias Ruby", "[\033[32mOK\033[0m] Dependencias de Ruby instaladas", warn_after=300, max_retries=10, retry_delay=10)
    if not ok:
        return False

    spinner = Spinner("Instalando dependencias de Yarn...")
    spinner.start()
    ok, _ = run_logged(["docker", "compose", "exec", "-T", "web", "yarn", "install", "--network-concurrency", "2", "--child-concurrency", "2"], spinner, "[\033[31mFAIL\033[0m] Error en dependencias Yarn", "[\033[32mOK\033[0m] Dependencias de Yarn instaladas", warn_after=180, max_retries=10, retry_delay=10)
    if not ok:
        return False

    spinner = Spinner("Inicializando base de datos de Canvas (db:create db:migrate)...")
    spinner.start()
    # brand_configs:write (parte de canvas:compile_assets) necesita que la BD
    # exista antes de poder ejecutar BrandConfig.clean_unused_from_db!.
    # db:create es idempotente; db:migrate tambien si ya esta al dia.
    run_logged(
        ["docker", "compose", "exec", "-T", "web", "bundle", "exec", "rake",
         "db:create", "db:migrate"],
        spinner,
        "[\033[33mWARN\033[0m] Advertencia en db:migrate (puede ignorarse si la BD ya existe)",
        "[\033[32mOK\033[0m] Base de datos inicializada",
        warn_after=300, max_retries=3, retry_delay=15)
    # No detenemos el flujo si falla: en un segundo intento la BD ya existe
    # y el error es inofensivo. Los assets pueden compilarse igual.

    spinner = Spinner("Limpiando caché de Rspack/Webpack para asegurar compilación limpia...")
    spinner.start()
    run_logged(["docker", "compose", "exec", "-T", "web", "bash", "-c", "rm -rf public/dist/* node_modules/.cache"], spinner, "[\033[33mWARN\033[0m] No se pudo limpiar la caché por completo", "[\033[32mOK\033[0m] Caché limpio", warn_after=60)

    spinner = Spinner("Normalizando saltos de línea (CRLF → LF) en scripts de Canvas...")
    spinner.start()
    # En Windows, git autocrlf deja los scripts con terminadores CRLF; dentro del
    # contenedor Linux eso rompe los shebangs (#!/usr/bin/env ...) y falla la build.
    # Se normalizan: bin/, script/ (ruby/rake), y packages/*/scripts/ (shell scripts
    # como canvas-rce/scripts/build-canvas que fallan con 'bash\r').
    run_logged(
        ["docker", "compose", "exec", "-T", "web", "bash", "-c",
         "find bin script packages -type f -name '*.sh' -o -type f -path '*/scripts/*' "
         "| xargs -r sed -i 's/\\r$//' 2>/dev/null; "
         "find bin script -type f | xargs -r sed -i 's/\\r$//' 2>/dev/null; true"],
        spinner,
        "[\033[33mWARN\033[0m] No se pudieron normalizar todos los scripts",
        "[\033[32mOK\033[0m] Saltos de línea normalizados (CRLF → LF)",
        warn_after=60)

    spinner = Spinner("Aplicando parches de compatibilidad de fuentes Canvas...")
    spinner.start()
    # ConfigureModal.tsx (copyright 2026) importa '@instructure/platform-alerts' que
    # no existe en yarn.lock ni en node_modules. La funcionalidad equivalente
    # (showFlashAlert) ya existe en '@canvas/alerts/react/FlashAlert'.
    run_logged(
        ["docker", "compose", "exec", "-T", "web", "bash", "-c",
         "sed -i \"s|from '@instructure/platform-alerts'|from '@canvas/alerts/react/FlashAlert'|g\" "
         "ui/features/discovery_page/react/components/ConfigureModal.tsx 2>/dev/null; true"],
        spinner,
        "[\033[33mWARN\033[0m] No se pudo aplicar el parche de platform-alerts",
        "[\033[32mOK\033[0m] Parches de compatibilidad aplicados",
        warn_after=30)

    spinner = Spinner("Generando traducciones (i18n:generate_js)...")
    spinner.start()
    run_logged(["docker", "compose", "exec", "-T", "web", "bundle", "exec", "rake", "i18n:generate_js"], spinner, "[\033[33mWARN\033[0m] Advertencia en i18n", "[\033[32mOK\033[0m] Traducciones generadas", warn_after=120)

    spinner = Spinner("Construyendo paquetes internos (canvas-rce, canvas-media, k5uploader)...")
    spinner.start()
    # wsrun build:packages compila canvas-rce, canvas-media y k5uploader a sus
    # distribuciones ES/CJS. Sin este paso, rspack falla con 'Module not found'
    # en @instructure/canvas-rce/es/... porque los archivos dist no existen.
    # Se ejecuta aqui, en serie y con salida visible, para detectar errores a tiempo.
    ok, _ = run_logged(
        ["docker", "compose", "exec", "-T", "web", "yarn", "run", "build:packages"],
        spinner,
        "[\033[31mFAIL\033[0m] Error construyendo paquetes internos (canvas-rce / canvas-media)",
        "[\033[32mOK\033[0m] Paquetes internos construidos",
        warn_after=300, max_retries=1, retry_delay=10)
    if not ok:
        return False

    spinner = Spinner("Compilando assets (10-15 mins). No cierre la consola...")
    spinner.start()
    # Se utiliza rake canvas:compile_assets para construir tanto CSS (brandable_css) como JS.
    # CANVAS_BUILD_CONCURRENCY limita el paralelismo (evita OOM y el error Parallel::UndumpableException
    # que oculta el fallo real) y NODE_OPTIONS reserva memoria para el build de JS.
    # COMPILE_ASSETS_BRAND_CONFIGS=0 omite brand_configs:write durante la compilacion
    # inicial para evitar ActiveRecord::ConnectionNotEstablished en workers forked
    # de Parallel cuando la BD aun no tiene el schema cargado. Los brand configs
    # se generan en un paso separado a continuacion, una vez que los assets existen.
    ok, _ = run_logged(
        ["docker", "compose", "exec", "-T",
         "-e", "CANVAS_BUILD_CONCURRENCY=2",
         "-e", "NODE_OPTIONS=--max-old-space-size=8192",
         "-e", "COMPILE_ASSETS_API_DOCS=0",
         "-e", "COMPILE_ASSETS_BRAND_CONFIGS=0",
         "web", "bundle", "exec", "rake", "canvas:compile_assets"],
        spinner, "[\033[31mFAIL\033[0m] Falló la compilación de assets", "[\033[32mOK\033[0m] Assets de Canvas LMS compilados exitosamente", warn_after=600)
    if not ok:
        return False

    spinner = Spinner("Generando brand configs (brand_configs:write)...")
    spinner.start()
    # Ahora que la BD existe y los assets estan compilados, se pueden generar
    # los archivos de brand config (.css variables, .js, .json) por tema.
    run_logged(
        ["docker", "compose", "exec", "-T", "web", "bundle", "exec", "rake",
         "brand_configs:write"],
        spinner,
        "[\033[33mWARN\033[0m] Advertencia en brand_configs:write (no critico)",
        "[\033[32mOK\033[0m] Brand configs generados",
        warn_after=120)
        
        
    return True



def main():
    configure_logging()
    logger = logging.getLogger(__name__)
    logger.info("Iniciando instalación automática de dependencias")
    print("\n" + "=" * 54)
    print("   INSTALACION AUTOMATICA DE DEPENDENCIAS")
    print("=" * 54)
    print()

    missing_docker = os.environ.get("MISSING_DOCKER") == "1"
    docker_daemon_down = os.environ.get("DOCKER_DAEMON_DOWN") == "1"
    missing_compose = os.environ.get("MISSING_COMPOSE") == "1"
    missing_canvas_clone = os.environ.get("MISSING_CANVAS_CLONE") == "1"
    missing_canvas_assets = os.environ.get("MISSING_CANVAS_ASSETS") == "1"
    missing_node = os.environ.get("MISSING_NODE") == "1"
    missing_npm = os.environ.get("MISSING_NPM") == "1"

    processed = []
    failed_critical = []
    logger.info("Componentes faltantes: docker=%s compose=%s canvas_clone=%s assets=%s node=%s npm=%s",
                missing_docker, missing_compose, missing_canvas_clone, missing_canvas_assets, missing_node, missing_npm)

    if missing_docker:
        logger.info("Iniciando instalación de Docker")
        print("[1/5] Instalando Docker...")
        print("=" * 54)
        print()
        print("       Docker Desktop se descargara e instalara.")
        print("       Esto puede tardar varios minutos dependiendo de su conexion.")
        print()
        print("       NOTA: Se requiere reiniciar el equipo despues de la instalacion.")
        print()
        if install_docker():
            processed.append("Docker")
            logger.info("Docker instalado exitosamente")
        else:
            failed_critical.append("Docker")
        print()
    elif docker_daemon_down:
        logger.info("Docker instalado pero el daemon no está corriendo: se abrirá Docker Desktop y se esperará el daemon")
        print("[1/5] Docker instalado: abriendo Docker Desktop y esperando al daemon...")
        print("=" * 54)
        print()
        print("       Docker Desktop ya está instalado en este equipo.")
        print("       El daemon no está en ejecución (no es necesario reinstalar).")
        print("       Se abrirá Docker Desktop; espere a que el daemon inicie.")
        print()
        if handle_docker_daemon_down():
            processed.append("Docker")
            logger.info("Docker daemon disponible tras abrir Docker Desktop")
        else:
            failed_critical.append("Docker (daemon)")
        print()

    if missing_compose:
        logger.info("Iniciando instalación de Docker Compose")
        print("[2/5] Instalando Docker Compose...")
        print("Docker Compose generalmente se incluye con Docker Desktop.")
        if install_docker_compose_standalone():
            processed.append("Docker Compose")
            logger.info("Docker Compose instalado exitosamente")
        else:
            failed_critical.append("Docker Compose")
        print()

    if missing_canvas_clone:
        logger.info("Iniciando clonación de Canvas LMS en %s", CANVAS_DIR)
        print("[3/5] Clonando repositorio Canvas LMS...")
        print()
        print(f"       Esto clonara el repositorio de Canvas LMS en:\n       {CANVAS_DIR}")
        print()
        print("       Esto puede tardar varios minutos dependiendo de su conexion.")
        print()
        if clone_canvas_lms():
            processed.append("Canvas LMS")
            missing_canvas_assets = True
            logger.info("Canvas LMS clonado exitosamente")
        else:
            failed_critical.append("Canvas LMS")
        print()

    if missing_canvas_assets and not missing_canvas_clone:
        logger.info("Assets de Canvas faltantes o sin compilar")
        print("[*] Assets de Canvas faltantes o sin compilar...")
        print()
        print("       Es necesario compilar los assets de Canvas (CSS/JS) para que la interfaz web cargue correctamente.")
        print("       Esto tomara bastante tiempo la primera vez.")
        print()
        if setup_canvas_assets():
            processed.append("Assets de Canvas LMS")
            logger.info("Assets de Canvas LMS compilados exitosamente")
        else:
            failed_critical.append("Assets de Canvas LMS")
        print()
    elif missing_canvas_assets and missing_canvas_clone:
        if "Canvas LMS" in processed:
            logger.info("Compilando assets automáticamente tras clonación de Canvas")
            print("[*] Compilando assets para la nueva instalacion de Canvas...")
            if setup_canvas_assets():
                processed.append("Assets de Canvas LMS")
                logger.info("Assets de Canvas LMS compilados exitosamente tras clonación")
            else:
                failed_critical.append("Assets de Canvas LMS")
            print()


    if missing_node:
        logger.info("Iniciando instalación de Node.js")
        print("[4/5] Instalando Node.js...")
        if install_nodejs():
            processed.append("Node.js")
            logger.info("Node.js instalado exitosamente")
        print()

    if missing_npm:
        logger.info("Verificando instalación de NPM")
        print("[5/5] NPM deberia haberse instalado junto con Node.js...")
        processed.append("NPM (verificar instalacion de Node.js)")
        logger.info("Usuario aceptó verificar instalación de NPM")



    logger.info("Resumen de instalación: %s", processed)
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
    if failed_critical:
        print("\033[31m" + "=" * 54 + "\033[0m")
        print("   \033[31mCOMPONENTES CRITICOS FALLIDOS\033[0m")
        print("\033[31m" + "=" * 54 + "\033[0m")
        print()
        for item in failed_critical:
            print(f"   \033[31m- {item}\033[0m")
        print()
        print("\033[31m" + "=" * 54 + "\033[0m")
        print()
        logger.error("Componentes críticos fallidos: %s", failed_critical)
        sys.exit(1)
    print("=" * 54)


if __name__ == "__main__":
    main()
