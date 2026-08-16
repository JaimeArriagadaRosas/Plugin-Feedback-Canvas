# Compatibilidad Docker del Instalador

Este documento describe cómo el instalador gestiona diferentes entornos de ejecución de Docker (Docker Desktop, Docker Engine nativo en Linux, Docker Rootless, WSL2) para prevenir problemas de permisos y garantizar una experiencia uniforme.

## Arquitectura Basada en Capacidades

A partir de la versión más reciente, el instalador ya no asume comportamientos basados únicamente en el sistema operativo (p. ej., "si es Linux, requiere sudo"). En su lugar, construye un **Docker Environment Profile** evaluando las capacidades reales del daemon.

El perfil incluye:
- `backend`: El tipo de instalación detectada (`docker-desktop-mac`, `docker-desktop-windows`, `docker-desktop-wsl`, `docker-engine-linux`, `remote`).
- `rootless`: Indica si el daemon corre en modo rootless, evitando la necesidad de privilegios elevados.
- `hostUid`: El ID del usuario actual en el sistema anfitrión.

## Gestión de Permisos y Volúmenes

Históricamente, el instalador utilizaba el flag `--user root` en comandos de `docker compose exec` para sortear problemas de permisos en los volúmenes montados. Esto provocaba que archivos generados dentro del contenedor pertenecieran a `root`, impidiendo su posterior modificación.

**Solución actual:**
1. **Sin `--user root`**: El flujo normal de `AssetBuilder` y `CanvasBringup` utiliza el usuario predeterminado de la imagen (usualmente `docker` UID 9999).
2. **Inyección de `USER_ID`**: Si se detecta un entorno Linux nativo rootful (`docker-engine-linux` convencional), el instalador inyecta el UID del host en `build.args.USER_ID` mediante un override en `docker-compose.override.yml`.
3. **Estrategia Rootless**: En configuraciones rootless o userns-remap, **NO** se inyecta `USER_ID` asumiendo equivalencia. Docker mapea el root interno al usuario host de manera transparente. El instalador ejecutará pruebas reales de escritura (`CanvasWorkspaceProbe`) usando el usuario normal de la imagen para garantizar que el bind mount es compatible. Si no lo es, fallará tempranamente con un diagnóstico explícito.
4. **Validación Temprana**: Se ha implementado `CanvasWorkspaceProbe` para verificar si es posible escribir en los volúmenes, comprobando proactivamente en lugar de suponer éxito.

## Evitando Ejecución con `sudo`

Se bloquea y rechaza terminantemente la ejecución del instalador principal (`npm start`) mediante `sudo`. Al intentarlo, el instalador abortará inmediatamente.
El comando `npm run diagnose` sí puede ejecutarse con `sudo` al ser una herramienta de solo lectura, pero emitirá un warning informando que el entorno podría ser alterado.

## Diagnóstico y Solución de Problemas

Se ha mejorado `npm run diagnose` (doctor) para que sea estrictamente de **sólo lectura**. Detecta si el comando se invocó con privilegios de superusuario y advierte sobre los peligros potenciales. 

Adicionalmente, si el setup encuentra errores `EACCES` u otras violaciones de permisos durante el arranque, el analizador de logs recomendará verificar el propietario de los archivos o reiniciar el volumen.
