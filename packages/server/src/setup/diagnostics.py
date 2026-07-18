import re

ERROR_SIGNATURES = [
    {
        "pattern": r"File not found with singular glob: (.+)",
        "type": "ARCHIVOS_PERDIDOS",
        "diagnosis": "El compilador de Assets no pudo encontrar un archivo específico. Esto suele pasar si Docker oculta archivos del host con volúmenes mal configurados.",
        "solution": "Verifica que en docker-compose.override.yml no estés aislando la carpeta entera 'public', sino específicamente 'public/dist'."
    },
    {
        "pattern": r"heap out of memory|ENOMEM|Killed",
        "type": "OUT_OF_MEMORY",
        "diagnosis": "El proceso (probablemente Node.js o Webpack) se quedó sin memoria RAM al intentar compilar.",
        "solution": "Aumenta la memoria límite en docker-compose.override.yml (ej. mem_limit: 4g) o reinicia Docker Desktop para liberar RAM."
    },
    {
        "pattern": r"ECONNRESET|ESOCKETTIMEDOUT|ETIMEDOUT|network timeout|Failed to fetch",
        "type": "NETWORK_ERROR",
        "diagnosis": "Hubo una caída o interrupción de internet mientras se descargaban paquetes.",
        "solution": "El instalador intentará reconectarse automáticamente. Si falla del todo, revisa tu conexión a internet o intenta usar una VPN."
    },
    {
        "pattern": r"PG::ConnectionBad|could not connect to server",
        "type": "DB_CONNECTION",
        "diagnosis": "La base de datos PostgreSQL de Canvas no está respondiendo o no ha terminado de encender.",
        "solution": "Asegúrate de que el contenedor de base de datos está corriendo. Si tu PC es lenta, a veces PostgreSQL tarda un par de minutos más en estar listo."
    },
    {
        "pattern": r"error running gulp rev",
        "type": "GULP_REV_ERROR",
        "diagnosis": "Gulp falló al intentar renombrar los archivos finales de Canvas. Generalmente es consecuencia de un archivo que faltó en un paso anterior.",
        "solution": "Sube un poco más arriba en el log para ver qué archivo faltó exactamente. Asegúrate de tener el código fuente de Canvas intacto."
    },
    {
        "pattern": r"Could not find gem '(.+)'",
        "type": "MISSING_GEM",
        "diagnosis": "Falta una gema de Ruby necesaria para Canvas.",
        "solution": "El comando 'bundle install' no se ejecutó correctamente o fue interrumpido. Intenta borrar la carpeta canvas-lms-master y reintentar la instalación."
    }
]

def analyze_log_and_diagnose(log_file_path, num_lines=150):
    try:
        with open(log_file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            recent_log = "".join(lines[-num_lines:])
    except Exception:
        return None

    for signature in ERROR_SIGNATURES:
        match = re.search(signature["pattern"], recent_log, re.IGNORECASE | re.MULTILINE)
        if match:
            # Si el patrón capturó grupos, podemos incluirlos
            details = match.group(1) if match.groups() else ""
            return {
                "type": signature["type"],
                "diagnosis": signature["diagnosis"],
                "solution": signature["solution"],
                "details": details
            }
    
    return {
        "type": "UNKNOWN",
        "diagnosis": "Fallo genérico detectado o error desconocido.",
        "solution": "Revisa las últimas líneas del archivo de registro para buscar la causa principal.",
        "details": ""
    }

def print_diagnosis_box(diagnosis_info):
    print("\n\033[31m" + "=" * 60 + "\033[0m")
    print("\033[1;31m   DIAGNÓSTICO AUTOMÁTICO DE ERROR (CÓDIGO 1)\033[0m")
    print("\033[31m" + "=" * 60 + "\033[0m\n")
    print(f"\033[1;33mCAUSA DETECTADA:\033[0m {diagnosis_info['diagnosis']}")
    if diagnosis_info.get("details"):
        print(f"\033[1;33mDETALLE TÉCNICO:\033[0m {diagnosis_info['details']}")
    print(f"\n\033[1;32mSOLUCIÓN RECOMENDADA:\033[0m")
    print(f"  {diagnosis_info['solution']}\n")
    print("\033[31m" + "=" * 60 + "\033[0m\n")
