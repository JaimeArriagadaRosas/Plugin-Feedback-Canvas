# Registro de decisiones arquitectónicas

Los ADR explican por qué existe una decisión. Los cambios nuevos deben añadir o reemplazar un ADR; no se reescribe el pasado para aparentar que una decisión siempre fue distinta.

## ADR-001: proxy TLS local para Canvas

- **Estado:** aceptado.
- **Contexto:** Canvas local sirve HTTP en `:8080`, mientras LTI y el navegador requieren orígenes HTTPS coherentes.
- **Decisión:** usar un proxy TLS local en `:8443` hacia Canvas HTTP.
- **Consecuencias:** hay certificados locales y un proceso adicional; producción debe usar TLS público en el proxy/ingress institucional, no este certificado.

## ADR-002: dependencias y Canvas fijados

- **Estado:** aceptado, revisado en agosto de 2026.
- **Contexto:** npm 9 no reprodujo el lockfile; una rama Canvas móvil hacía el setup no determinista.
- **Decisión:** declarar Node `^20.19.0 || >=22.12.0`, npm 11.8.0 y fijar Canvas local a `release/2026-05-20.143`.
- **Consecuencias:** instalaciones con `npx --yes npm@11.8.0 ci`; las actualizaciones requieren una rama, revisión de lockfile y regresión del setup.

## ADR-003: monorepo con npm workspaces

- **Estado:** aceptado.
- **Contexto:** cliente y servidor evolucionan juntos y comparten una única entrega.
- **Decisión:** usar un repositorio con workspaces `apps/*` y reserva `packages/*`.
- **Consecuencias:** un solo lockfile y pipeline. En el árbol actual solo `apps/client` y `apps/server` son workspaces efectivos; no se documentan paquetes compartidos inexistentes.

## ADR-004: proveedores de IA mediante estrategia/factoría

- **Estado:** aceptado; reemplaza la decisión «Gemini como único motor».
- **Contexto:** distintos entornos requieren Gemini, OpenAI, Claude o un endpoint compatible/personalizado.
- **Decisión:** seleccionar un adaptador con `IAProviderFactory`; el dominio de feedback no conoce detalles HTTP de cada proveedor.
- **Consecuencias:** cada adaptador debe normalizar errores, timeouts y modelos; credenciales se cifran/gestionan fuera del frontend. Gemini puede ser el default local sin convertirse en dependencia única.

## ADR-005: Canvas local fuera del repositorio

- **Estado:** aceptado.
- **Contexto:** Canvas LMS es un proyecto upstream grande usado como simulador, no lógica del plugin.
- **Decisión:** mantener `canvas-lms-master` como carpeta hermana y fijar la release.
- **Consecuencias:** no se versionan assets/configuración generada de Canvas; el setup protege destinos desconocidos y conserva `.env` existente.

## ADR-006: adaptación explícita por sistema operativo

- **Estado:** aceptado.
- **Contexto:** una única rama condicional mezclaba Docker Desktop/UAC, APT/systemd, Gatekeeper y WSL.
- **Decisión:** probes y políticas compartidas; acciones nativas en adaptadores `Win…`, `Mac…`, `Linux…` y políticas WSL.
- **Consecuencias:** una plataforma no emite instrucciones de otra; agregar un sistema exige adaptador y tests específicos sin inflar el coordinador.

## ADR-007: Docker rootless preferido en Linux

- **Estado:** aceptado.
- **Contexto:** el grupo `docker` concede control equivalente a root y provocaba problemas de permisos/seguridad.
- **Decisión:** después de instalar Docker Engine, ofrecer rootless como opción recomendada; el grupo requiere una confirmación separada.
- **Consecuencias:** aparecen mapeos UID/GID y algunas limitaciones de cgroups/red; los writes de Canvas se ejecutan con el usuario interno necesario sin convertir al host en root.

## ADR-008: configuración Canvas mediante overrides reanudables

- **Estado:** aceptado.
- **Contexto:** editar/destruir configuración upstream hacía el setup frágil y no idempotente.
- **Decisión:** conservar archivos existentes, partir de plantillas Docker oficiales y aplicar overrides/versiones locales explícitas.
- **Consecuencias:** el setup debe distinguir carpeta ausente, reconocida y desconocida; cualquier reset destructivo queda fuera de la recuperación automática.

## ADR-009: instalación npm reproducible en preboot

- **Estado:** aceptado.
- **Contexto:** `npm install`, `shell: true` y reintentos ilimitados podían modificar lockfile o saturar procesos.
- **Decisión:** invocar `npx --yes npm@11.8.0 ci` con argumentos estructurados y como máximo un intento de reparación.
- **Consecuencias:** el arranque falla de forma visible si la instalación reproducible no puede completarse; no oculta incompatibilidades mediante otra resolución.

## ADR-010: sufijo `.local` como adaptador versionado

- **Estado:** aceptado con migración progresiva.
- **Contexto:** `.local` se usa para comportamiento propio del entorno de desarrollo, no para secretos ignorados por Git.
- **Decisión:** versionar esos módulos y activarlos solo desde composition roots/guardas locales. Compartir dominio y casos de uso.
- **Consecuencias:** no se aplica una regla `.gitignore` global a `*.local.*`; cada bypass debe demostrar que producción no puede alcanzarlo.

## ADR-011: Eliminación del directorio `scripts/`

- **Estado:** aceptado y completado.
- **Contexto:** existían scripts heredados de deploy, reparación y diagnóstico con responsabilidad desigual en un directorio raíz genérico.
- **Decisión:** el directorio `scripts/` ha sido eliminado. La lógica de entrada y los comandos operativos ahora viven en sus módulos correspondientes, como `apps/installer/src/commands/` y `apps/server/bin/`.
- **Consecuencias:** mayor cohesión; las dependencias están claras para cada aplicación.
