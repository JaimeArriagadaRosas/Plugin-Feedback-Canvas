# Entorno de ejecución reproducible

## 1. Versiones

| Componente | Política actual |
|---|---|
| Node.js | `^20.19.0 || >=22.12.0` |
| npm | exactamente `11.8.0` para reproducir el lockfile |
| CI | Node `22.12.0` + npm `11.8.0` |
| Imagen del servidor | Node `24-alpine` |
| React | `18.2.0` |
| Vite | `8.1.5` |
| PostgreSQL del plugin | imagen `postgres:15-alpine` |
| Gotenberg | imagen mayor `gotenberg/gotenberg:8` |
| Canvas local | `release/2026-05-20.143` |

Instalación reproducible:

```bash
npx --yes npm@11.8.0 ci
```

No use `npm install` en CI, imágenes, preboot ni para «arreglar» un lockfile. Los rangos de algunas dependencias de desarrollo siguen resolviéndose mediante `package-lock.json`.

## 2. Modos de arranque

| Variable | Valor | Significado |
|---|---:|---|
| `STARTUP_MODE` | `1` | runtime LTI para Canvas externo |
| `STARTUP_MODE` | `2` | asistente de despliegue/registro |
| `STARTUP_MODE` | `3` | Canvas local Docker |
| `STARTUP_MODE` | `4` | validaciones de caja negra |
| `NON_INTERACTIVE` | `true` | usa `STARTUP_MODE` sin preguntar en el menú |

Ejemplo temporal:

```bash
NON_INTERACTIVE=true STARTUP_MODE=3 npm start
```

## 3. Archivo `.env`

El preflight conserva `.env` si ya existe. Si no existe, usa `.env.example` cuando esté disponible; en el árbol actual también existe una plantilla fallback en `EnvironmentDetector` para no bloquear el setup local.

`.env` es generado y está ignorado por Git. No es fuente de configuración productiva ni debe copiarse entre equipos sin revisar cada valor.

## 4. Variables principales

### Base de datos

| Variable | Propósito |
|---|---|
| `DATABASE_URL` | cadena completa cuando el entorno la proporciona |
| `DB_HOST`, `DB_PORT` | host/puerto PostgreSQL |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | credenciales y base del plugin |
| `AUTO_MIGRATE` | ejecuta migraciones al arranque solo si es `true` |

### Canvas y LTI

| Variable | Propósito |
|---|---|
| `CANVAS_BASE_URL` | origen público/base de Canvas |
| `CANVAS_API_HOST` | hostname/host:port utilizado por `CanvasClient` al construir las URLs de la API REST |
| `CANVAS_ACCESS_TOKEN` | token API para flujos que lo requieran |
| `CANVAS_COURSE_ID` | curso local o de prueba seleccionado |
| `LTI_CLIENT_ID` | client ID de la Developer Key |
| `LTI_CLIENT_SECRET` | secreto LTI principal para OAuth2 |
| `CANVAS_CLIENT_SECRET` | alias de `LTI_CLIENT_SECRET` aceptado por `CanvasOAuthController` y `CanvasTokenManager` |
| `LTI_DEPLOYMENT_IDS` | deployments permitidos |
| `LTI_ISSUER`, `LTI_OIDC_URL` | plataforma y endpoint OIDC |
| `LTI_REDIRECT_URI` | callback registrado |
| `LTI_KEY_ID` | identificador de clave del plugin |

### Aplicación y servicios

| Variable | Propósito |
|---|---|
| `PORT` | puerto del backend; valor habitual 3000 |
| `FRONTEND_URL`, `FRONTEND_DIST` | origen de UI y build servido |
| `GOTENBERG_URL` | servicio de conversión de documentos |
| `REDIS_URL` | Redis cuando el entorno/servicio lo use |
| `LOG_LEVEL`, `LOG_TO_FILE` | nivel y destino de logs |
| `ENCRYPTION_KEY` | cifrado de valores sensibles persistidos |
| `DEV_TOKEN_SECRET` | firma de tokens de desarrollo local |

### Desarrollo local

| Variable | Regla |
|---|---|
| `USE_LOCAL_DATA` | `false` fuera de desarrollo |
| `VITE_USE_LOCAL_DATA` | `false` en builds/despliegues reales |
| `ENABLE_TEST_AUTH_BYPASS` | prohibido en producción |
| `CANVAS_ADMIN_PASS`, `CANVAS_TEACHER_PASS`, `CANVAS_STUDENT_PASS` | solo fixtures locales |

Las claves de proveedores de IA también son secretos. Gemini admite `GEMINI_API_KEY`; otros proveedores se configuran mediante la capa administrativa/persistencia cifrada según el flujo actual. No invente una variable genérica sin comprobar su consumo en código.

## 5. Archivos y estado generados

| Ruta | Contenido | Versionar |
|---|---|---|
| `.env` | configuración/secretos locales | no |
| `.setup_complete` | marcador de fast boot | no |
| `tmp/canvas_local_users.json` | perfiles y tokens sintéticos exportados | no |
| `logs/` | logs operativos | no |
| `dist/` | build del frontend | no |
| `node_modules/` | dependencias instaladas | no |
| `canvas-lms-master/` | checkout externo Canvas | no, vive fuera del repo |

Los archivos de código `*.local.js` sí se versionan: expresan adaptadores locales, no secretos personales.

## 6. Contenedores y memoria

- Windows: Docker Desktop/WSL2.
- Linux: Docker Engine + Compose V2; se recomienda rootless.
- WSL2: Docker Desktop integrado o Engine nativo, no ambos implícitamente.
- macOS: OrbStack o Docker Desktop.

El setup calcula límites de Canvas desde la memoria visible para Docker. Aproximadamente 8 GiB disponibles es el mínimo práctico del flujo local; una compilación puede requerir más CPU, disco y tiempo aunque los límites sean conservadores.

## 7. Producción

- Inyecte secretos desde el sistema de despliegue o gestor de secretos.
- Use contraseñas/keys nuevas, rotables y distintas de fixtures.
- Mantenga `NODE_ENV=production`, bypass local desactivado y orígenes públicos HTTPS coherentes.
- Ejecute migraciones como etapa controlada y con backup/rollback.
- No incorpore `.env`, claves privadas o certificados locales a la imagen.
- Valide que `config/lti_placement.json` sea generado para el dominio real; el archivo versionado contiene endpoints localhost.

## 8. Verificación

```bash
node --version
npx --yes npm@11.8.0 --version
docker info
docker compose version
npx --yes npm@11.8.0 run lint
npx --yes npm@11.8.0 test
npx --yes npm@11.8.0 run build
```
