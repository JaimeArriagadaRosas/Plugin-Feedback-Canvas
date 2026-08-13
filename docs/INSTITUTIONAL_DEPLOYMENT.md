# Recomendaciones para un despliegue institucional Canvas

Este documento orienta un piloto universitario (por ejemplo, UNAB). La decisión final pertenece a administración Canvas, seguridad, infraestructura, protección de datos y dueños académicos.

## 1. Cuenta raíz o subcuenta

Canvas permite instalar herramientas a nivel de cuenta o curso. Para un piloto:

- prefiera una **subcuenta** o conjunto de cursos controlados;
- use cuenta raíz solo si la herramienta es institucional, el placement es deseado para todos y los scopes fueron aprobados;
- documente quién puede habilitar/deshabilitar la herramienta y cómo se revierte.

Una subcuenta reduce alcance operacional, pero no reemplaza autorización interna del plugin ni minimización de scopes.

## 2. Placement actual

`config/lti_placement.json` contiene un placement local `course_navigation` con `visibility: "public"`. La documentación antigua afirmaba `visibility: "admins"`; eso no coincide con el código.

Antes del piloto decida qué roles deben ver el enlace y genere una configuración productiva. La visibilidad del menú no es control de acceso: el backend siempre debe autorizar el rol y contexto del launch.

## 3. Origen y proxy

Sirva frontend y backend del plugin bajo un mismo origen, por ejemplo:

```text
https://feedback.institucion.example/
https://feedback.institucion.example/api/...
```

Esto simplifica CORS y la sesión interna del plugin. No elimina por sí solo el problema de cookies de terceros: Canvas y el plugin siguen siendo sitios distintos cuando la herramienta está en iframe. Valide `Secure`, `SameSite`, redirects OIDC, políticas del navegador y alternativas que no dependan de almacenamiento bloqueado.

## 4. LTI Advantage y scopes

Scopes actuales:

| Servicio | Scope | Uso esperado |
|---|---|---|
| AGS | `lineitem` | consultar/administrar line items autorizados |
| AGS | `result.readonly` | leer resultados |
| AGS | `score` | publicar puntuaciones cuando el flujo lo requiera |
| NRPS | `contextmembership.readonly` | obtener membresías/roles del contexto |

Valide si todos son necesarios para los requisitos aprobados. La publicación de feedback mediante APIs Canvas y el acceso a entregas pueden requerir scopes Canvas adicionales en el token/API correspondiente; no amplíe permisos por comodidad.

## 5. Identidad y autorización

- allowlist de issuers y deployments institucionales;
- validación de firma con JWKS Canvas y rotación/cache segura;
- `state` y `nonce` de un solo uso con expiración;
- autorización por rol, curso, cuenta y pertenencia;
- mapeo estable entre subject LTI y usuario interno;
- revocación cuando cambia una matrícula/rol;
- auditoría sin tokens ni datos sensibles.

Si hay varias réplicas, el estado OIDC, sesiones, idempotencia y jobs no puede depender de memoria de un único proceso.

## 6. Datos personales y académicos

Antes de habilitar IA:

- defina qué datos del estudiante salen de la institución;
- minimice nombres, entregas, calificaciones y contexto;
- establezca base legal, retención, residencia y contrato del proveedor;
- permita revisión humana antes del envío;
- registre proveedor/modelo/configuración sin almacenar secretos;
- documente corrección, eliminación y respuesta a incidentes.

Los mocks SIS/locales no pueden confundirse con integraciones institucionales reales.

## 7. Proveedores de IA

La factoría admite Gemini, OpenAI, Claude y custom. La institución debe aprobar:

- proveedor y endpoints;
- modelos permitidos;
- claves por entorno y rotación;
- límites/cuotas y manejo de rate limit;
- política de contenido y datos;
- fallback cuando IA está deshabilitada.

La ausencia de clave/IA debe producir un modo legible y explícito, no una pantalla indefinidamente cargando.

## 8. Correo y notificaciones

El adaptador actual `EmailService.local.js` escribe `local-emails.log`; no envía correo institucional. Producción requiere:

- proveedor SMTP/API aprobado;
- remitente/dominio verificado;
- plantillas accesibles;
- retries idempotentes y dead-letter;
- preferencias/consentimiento;
- métricas de entrega, rebote y queja;
- pruebas RF42/RF44 con cuentas de staging.

## 9. Operación

Defina propietarios para:

- disponibilidad y on-call;
- PostgreSQL, backups y restauración;
- certificados, claves y rotación;
- actualizaciones Canvas/LTI;
- cuotas IA y costos;
- soporte docente/estudiantil;
- incidentes de privacidad/seguridad;
- rollback de aplicación y migraciones.

## 10. Piloto progresivo

1. laboratorio local con datos sintéticos;
2. Canvas staging y dominio TLS real;
3. curso cerrado con administradores/QA;
4. profesores voluntarios y estudiantes de prueba;
5. piloto de subcuenta con monitoreo y soporte;
6. evaluación de calidad, seguridad, costos y operación;
7. decisión formal antes de ampliar alcance.

No promueva la herramienta a cuenta raíz solo porque el setup local funciona.

## 11. Evidencia de aprobación

- configuración LTI y scopes firmados por responsables;
- matriz de roles/cursos y pruebas negativas;
- DPIA/evaluación de privacidad si aplica;
- threat model y escaneo de seguridad;
- E2E de generación/revisión/envío/notificación;
- carga con escenarios autorizados;
- recuperación de backup y rollback;
- manual operativo y mesa de ayuda;
- criterios de éxito y salida del piloto.
