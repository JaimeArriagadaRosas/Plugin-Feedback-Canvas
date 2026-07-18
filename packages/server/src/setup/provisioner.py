import logging

from spinner import Spinner

logger = logging.getLogger(__name__)


def confirm_installation(missing):
    logger.info("Componentes faltantes detectados: %s", list(missing.keys()))
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
    
    if "missing_docker" in missing:
        print("\n\033[33mDocker no está instalado en el sistema.\033[0m")
        print("La instalación de Docker Desktop puede requerir permisos de administrador y un reinicio.")
        ans = input("¿Desea instalar Docker Desktop automáticamente? (s/N): ").strip().lower()
        if ans not in ['s', 'si', 'y', 'yes']:
            logger.info("El usuario declinó instalar Docker.")
            return False

    logger.info("Instalación automática aceptada")
    return True
