# Desarrollo local y Canvas LMS

Esta guía describe el ciclo local del plugin. `canvas-lms-master` es una dependencia externa de simulación: no pertenece al dominio del plugin ni debe incorporarse al repositorio.

## 1. Modos del orquestador

Ejecute desde la raíz:

```bash
npm start
```

| Modo | Uso | Estado |
|---:|---|---|
| 1 | Runtime LTI 1.3 para Canvas externo | implementado; pendiente de validación institucional completa |
| 2 | Asistente de registro/despliegue LTI | implementado; requiere token/Developer Key y staging controlado |
| 3 | Canvas LMS local en Docker | flujo principal de desarrollo y QA local |
| 4 | Validaciones de caja negra | ejecuta el runner actual y propaga el código de error |

Para automatizar la elección:

```bash
NON_INTERACTIVE=true STARTUP_MODE=3 npm start
```

Las variables solo se aplican a ese proceso. No convierten permanentemente el shell al modo 3.

## 2. Qué hace el modo 3

1. Comprueba Node, npm, plataforma, Docker, Compose, memoria y puertos.
2. Crea/conserva `.env` y genera claves locales faltantes.
3. Clona o instala Canvas `release/2026-05-20.143` como carpeta hermana.
4. Prepara configuración Docker de Canvas mediante overrides.
5. Instala Bundler/Yarn y compila assets con pasos reanudables.
6. Levanta PostgreSQL, Redis, `web` y `jobs` de Canvas.
7. Ejecuta seeds sintéticos e instala la herramienta LTI local.
8. Levanta PostgreSQL y Gotenberg del plugin, ejecuta migraciones y sincroniza usuarios.
9. Arranca backend, frontend y proxy TLS local.
10. Comprueba readiness y abre el navegador cuando corresponde.

Los marcadores `.assets_built` y `.setup_complete` aceleran repeticiones, pero el preflight vuelve a comprobar dependencias críticas.

## 3. Recursos locales

| Recurso | Dirección/ubicación |
|---|---|
| Backend del plugin | `https://localhost:3000` |
| Frontend Vite | `https://localhost:5173` |
| Canvas por proxy TLS | `https://localhost:8443` |
| Canvas HTTP | `http://localhost:8080` |
| Alias de Canvas en hosts | `canvas.docker -> 127.0.0.1` |
| Gotenberg del plugin | `http://localhost:3001` |
| Usuarios/tokens exportados | `tmp/canvas_local_users.json` (generado, no versionado) |

Para añadir el alias local:

```bash
npm run setup:hosts
```

El comando modifica el archivo hosts y requiere privilegios. Para revertir:

```bash
npm run setup:hosts -- --remove
```

## 4. Cuentas sintéticas

| Perfil | Correo | Contraseña inicial |
|---|---|---|
| Administrador | `admin@canvas.local` | `password123` |
| Profesor principal | `profesor@canvas.local` | `password123` |
| Profesor adicional | `profesor2@canvas.local` | `password123` |
| Profesor adicional | `profesor3@canvas.local` | `password123` |
| Juan Pérez | `estudiante1@canvas.local` | `password123` |
| María García | `estudiante2@canvas.local` | `password123` |
| Pedro López | `estudiante3@canvas.local` | `password123` |
| Ana Torres | `estudiante4@canvas.local` | `password123` |
| Carlos Méndez | `estudiante5@canvas.local` | `password123` |

Estas credenciales están hardcodeadas como fixtures públicos. Nunca las use en staging o producción.

## 5. LTI real local y autenticación de desarrollo

El flujo preferido inicia desde Canvas local y ejecuta OIDC/LTI 1.3, incluyendo validación de JWT, `state`, `nonce`, roles y contexto de curso.

Existe además un proveedor de identidad local para desarrollo rápido. Solo acepta el modo local permitido o `ENABLE_TEST_AUTH_BYPASS=true`, y los `dev-token` deben estar firmados con `DEV_TOKEN_SECRET`. No documentamos cookies fabricadas manualmente porque una firma inválida debe rechazarse.

Reglas de seguridad:

- `ENABLE_TEST_AUTH_BYPASS` no debe estar activo en producción.
- `USE_LOCAL_DATA` y `VITE_USE_LOCAL_DATA` deben ser `false` en producción.
- Los roles locales (`admin`, `teacher`, `student-N`) no sustituyen una prueba LTI real.
- No copie a producción `.env`, tokens exportados, certificados ni usuarios del seed.

## 6. Desarrollo por procesos separados

Para cambios rápidos de interfaz puede ejecutar componentes por separado:

Terminal 1:

```bash
npm run server
```

Terminal 2:

```bash
npm run dev
```

El script del backend usa `node`, no Nodemon: los cambios del servidor requieren reiniciarlo. Vite sí ofrece recarga del frontend.

Este modo no prepara Canvas, Docker, seeds ni el proxy completo. Úselo solo cuando esas dependencias ya existan o cuando trabaje con datos locales controlados.

## 7. Observar el stack

Desde la carpeta de Canvas:

```bash
docker compose ps
docker compose logs --tail=100 web
docker compose logs --tail=100 jobs
curl -I http://localhost:8080/login
```

Un `302` al consultar `/login` suele ser una redirección normal de Canvas.

Desde la raíz del plugin:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
```

No mezcle comandos Compose de Canvas con los del plugin; confirme primero `pwd`.

## 8. Detener y reanudar

`Ctrl+C` solicita el cierre ordenado del orquestador y de sus procesos hijo. Para pausar un stack Compose concreto:

```bash
docker compose stop
docker compose start
```

`docker compose down` elimina contenedores/redes del stack. `docker compose down -v` también elimina volúmenes y datos: no lo ejecute como troubleshooting rutinario.

El setup no debe borrar automáticamente una carpeta Canvas desconocida ni volúmenes persistentes. Ante un conflicto, respalde y decida el reset de forma explícita.

## 9. Flujo diario sugerido

```bash
cd /ruta/al/Plugin-Feedback
git status
docker info
npm start
```

Antes de cerrar un cambio:

```bash
npx --yes npm@11.8.0 run lint
npx --yes npm@11.8.0 test
npx --yes npm@11.8.0 run build
```

Consulte [TESTING.md](TESTING.md) para las pruebas de cliente, integración y E2E.
