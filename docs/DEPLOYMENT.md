# Despliegue y validación LTI 1.3

> [!WARNING]
> Esta guía describe el camino de validación; el proyecto no está certificado para producción. Use primero un Canvas de staging, cuentas sintéticas y una infraestructura descartable/recuperable.

## 1. Componentes productivos esperados

```text
Internet / Canvas
        |
  HTTPS 443 (dominio del plugin)
        |
Reverse proxy / load balancer
        |
Node app :3000  ----> Gotenberg
        |
PostgreSQL gestionado o respaldado
```

El frontend compilado y la API deben presentarse bajo un origen público coherente. Canvas seguirá siendo un sitio distinto que puede cargar la herramienta en iframe; la política de cookies/sesión LTI debe validarse en navegadores reales.

## 2. Prerrequisitos de staging

- dominio y certificado TLS válidos;
- Canvas de staging y administrador autorizado;
- Developer Key/configuración LTI 1.3;
- cuenta/subcuenta y curso de prueba;
- PostgreSQL con backup/restore;
- Gotenberg aislado;
- gestor de secretos;
- logs centralizados y métricas;
- responsable de rollback y ventana de cambio.

No use las cuentas `@canvas.local`, `password123`, certificados localhost ni tokens del seed.

## 3. Build reproducible

```bash
npx --yes npm@11.8.0 ci
npx --yes npm@11.8.0 run lint
npx --yes npm@11.8.0 test
npx --yes npm@11.8.0 run build
```

La imagen versionada se construye con `apps/server/Dockerfile`, genera `dist`, poda dependencias de desarrollo y ejecuta como usuario `node`.

Etiquete imágenes por commit/release; no dependa de `plugin-feedback-app:latest` como identificador de rollback.

## 4. Migraciones

Punto de entrada:

```bash
npm run db:migrate
```

El servidor solo auto-migra si `AUTO_MIGRATE=true`. La composición productiva define un servicio `migrate`, pero debe validarse contra una copia de staging antes de usarla.

Procedimiento recomendado:

1. backup y prueba de restauración;
2. revisar migraciones pendientes y locks esperados;
3. detener o compatibilizar escrituras según la migración;
4. ejecutar migraciones una vez;
5. verificar esquema y health;
6. desplegar app compatible;
7. conservar plan de rollback de aplicación/datos.

## 5. Configuración LTI

El archivo `config/lti_placement.json` es una plantilla **local**: contiene `localhost`, `course_navigation` y endpoints de desarrollo. Para staging/producción se debe generar/revisar un JSON con el dominio real.

Endpoints del plugin:

| Función | Ruta |
|---|---|
| OIDC initiation | `/api/lti/login` |
| target/callback | `/api/lti/callback` |
| JWKS | `/api/lti/jwks` |

Scopes versionados actualmente:

- AGS `lineitem`;
- AGS `result.readonly`;
- AGS `score`;
- NRPS `contextmembership.readonly`.

Habilite solo los scopes necesarios y compruebe que la configuración de la Developer Key, el deployment y la instalación en cuenta/subcuenta coinciden. Canvas recomienda configurar los cambios LTI 1.3 en el registro/Developer Key asociado, no editar herramientas individuales como fuente primaria.

Documentación oficial: [configuración LTI 1.3 de Canvas](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_dev_key_config) y [External Tools API](https://developerdocs.instructure.com/services/canvas/resources/external_tools).

## 6. Asistente del repositorio

```bash
npm run deploy:lti
# o npm start y opción 2
```

El asistente prepara configuración y puede usar la API Canvas con un token autorizado. Antes de aprobar sus cambios:

- confirme URL, cuenta/subcuenta y curso;
- revise scopes y placement;
- no pegue tokens en terminales grabadas o logs compartidos;
- exporte/registre el estado anterior para rollback;
- verifique manualmente la herramienta creada.

El modo 2 no sustituye revisión administrativa ni un E2E real.

## 7. Runtime

El modo 1 espera configuración LTI y un build `dist` existente:

```bash
npm run build
NON_INTERACTIVE=true STARTUP_MODE=1 npm start
```

Mantener una consola abierta no es una estrategia productiva. Use una plataforma de contenedores o un supervisor con:

- reinicio limitado y backoff;
- señales `SIGTERM` y tiempo de drenaje;
- health/readiness independientes;
- logs stdout/stderr centralizados;
- límites de CPU/RAM;
- despliegue rolling o blue/green probado.

PM2, systemd, Kubernetes o un servicio gestionado son decisiones de infraestructura; el repositorio no incluye hoy una configuración PM2 certificada.

## 8. Docker Compose de producción

`docker-compose.yml` + `docker-compose.prod.yml` sirven como referencia local de imagen, DB, Gotenberg y migración. Antes de producción se debe corregir/validar externamente:

- imágenes etiquetadas e inmutables;
- secretos sin defaults `CHANGE_ME`;
- TLS/reverse proxy;
- backups y almacenamiento;
- exposición de puertos/firewall;
- healthcheck real y tiempo de startup;
- límites soportados por el runtime elegido;
- alta disponibilidad y mantenimiento de PostgreSQL;
- observabilidad y alertas.

Validar sintaxis no demuestra operabilidad:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config -q
```

## 9. Variables productivas mínimas

Revise [ENVIRONMENT.md](ENVIRONMENT.md). Como mínimo:

- conexión PostgreSQL sin credenciales por defecto;
- `CANVAS_BASE_URL`, issuer/OIDC y endpoints públicos;
- client/deployment IDs LTI;
- `ENCRYPTION_KEY` y material de firma gestionado;
- origen frontend/backend público;
- Gotenberg interno;
- proveedor IA y credenciales cifradas;
- bypass y datos locales desactivados.

## 10. Validación de staging

Por cada rol autorizado:

1. lanzar desde Canvas, no mediante URL directa;
2. validar `state`, `nonce`, firma y deployment;
3. comprobar curso/usuario/rol mostrados;
4. crear/configurar plantilla y variables;
5. generar feedback individual y masivo;
6. editar, aprobar y enviar;
7. confirmar comentario y nombre del usuario en Canvas;
8. comprobar notas privadas y aislamiento;
9. validar preferencias/notificaciones y correo real;
10. repetir en navegadores soportados y sesión iframe.

Además, pruebe reinicio durante jobs, degradación de IA/Canvas/Gotenberg, expiración de tokens, migración, backup/restore y rollback.

## 11. Bloqueadores actuales

- no existe adaptador de correo productivo;
- la generación masiva usa trabajo en memoria y se pierde si el proceso reinicia;
- E2E UI/LTI aún no cubre todos los resultados críticos;
- RF06 escribe código al filesystem;
- falta matriz final en Linux nativo y otro Windows limpio;
- las claves históricas identificadas deben considerarse expuestas y rotarse;
- falta evidencia productiva de carga, observabilidad y recuperación.

Hasta cerrar estos puntos, el resultado del checklist es **NO-GO**.
