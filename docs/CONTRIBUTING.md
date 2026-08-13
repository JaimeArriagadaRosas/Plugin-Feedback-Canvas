# Guía de contribución

## 1. Preparar el repositorio

```bash
git clone https://github.com/JaimeArriagadaRosas/Plugin-Feedback-Canvas.git
cd Plugin-Feedback-Canvas
npx --yes npm@11.8.0 ci
```

Requisitos: Node `^20.19.0 || >=22.12.0`, npm 11.8.0 y Git. Docker solo es obligatorio para integración, Canvas local y E2E reales.

Antes de modificar:

```bash
git status
git branch --show-current
```

Trabaje en una rama enfocada; no mezcle refactors masivos con una corrección funcional sin una justificación verificable.

## 2. Límites de diseño

- Máximo recomendado de 300 líneas por archivo.
- Máximo recomendado de 100 líneas por función.
- Una responsabilidad principal por módulo/clase.
- Dependencias externas detrás de adaptadores o servicios inyectables.
- Controladores finos: validan/adaptan HTTP y delegan casos de uso.
- Repositorios encapsulan SQL/persistencia; componentes React no conocen detalles de base de datos.
- Cada bug corregido incorpora una regresión proporcional.

Cuando un archivo supera un límite por documentación generada o una tabla declarativa, documente la excepción; no compacte código para «cumplir» a costa de legibilidad.

## 3. Monorepo

Los paquetes activos son:

```text
apps/client/    React + Vite
apps/server/    Node.js + Express
```

El patrón `packages/*` está reservado en los workspaces, pero no hay paquetes compartidos activos en el árbol actual. Si se crea uno, debe tener límites y propietario claros.

Ejecute scripts desde la raíz para que npm resuelva workspaces y lockfile de forma uniforme.

## 4. Lógica por plataforma

- Código exclusivamente Windows: adaptador/clase `Windows…` o `Win…`.
- Código exclusivamente Linux: `Linux…`.
- Diferencias específicas WSL: `Wsl…` o política WSL explícita.
- Código exclusivamente macOS: `Mac…`.
- Lógica compartida no debe llevar un prefijo de sistema.

Los probes observan y reportan; los instaladores mutan después de consentimiento. No mezcle descargas de Docker Desktop, APT, UAC, `sudo`, Gatekeeper o `.wslconfig` en un único archivo condicional.

## 5. Código local y producción

Los sufijos `.local.js`/`_local.js` indican un adaptador versionado para desarrollo, no un archivo privado. Nunca deben contener secretos.

- Comparta dominio y casos de uso entre local/producción.
- Sustituya infraestructura mediante composition roots/adaptadores.
- El bypass local requiere guardas explícitas y tests que demuestren que producción lo rechaza.
- No cree una segunda implementación completa solo para cambiar la fuente de datos.

## 6. Antiguo directorio `scripts/`

El directorio `scripts/` ha sido eliminado y su contenido redistribuido. Los comandos operativos y de diagnóstico ahora residen en `apps/installer/src/commands/` y `apps/server/bin/`. Nueva lógica de negocio, detección de plataforma o migraciones deben ubicarse en el módulo correspondiente.


## 7. Desarrollo

```bash
npm run server   # backend; reinicio manual al cambiar código
npm run dev      # frontend Vite con HMR
```

Para Canvas completo:

```bash
npm start
# seleccionar opción 3
```

No ejecute el proyecto Linux desde `/mnt/c` o `/mnt/d` si usa Docker Engine dentro de WSL2; clone en `/home/<usuario>/...`.

## 8. Pruebas requeridas

Base para cualquier cambio:

```bash
npx --yes npm@11.8.0 run lint
npx --yes npm@11.8.0 test
npx --yes npm@11.8.0 run build
```

Si cambia el cliente:

```bash
npx playwright install chromium
npx --yes npm@11.8.0 run test:client
```

Si cambia persistencia/integración:

```bash
npx --yes npm@11.8.0 run test:integration
```

Si cambia setup/plataforma, agregue tests con dependencias inyectadas y valide al menos el sistema afectado. Un mock de Docker no demuestra una instalación real.

Consulte [TESTING.md](TESTING.md) para la matriz completa.

## 9. Base de datos

- Añada una migración incremental en `packages/plugin-database/migrations/`; no reescriba una migración ya aplicada.
- Diseñe migraciones reanudables cuando sea razonable.
- No incluya datos institucionales reales en seeds.
- Cambios destructivos requieren backup, estrategia de rollback y aprobación explícita.
- Actualice repositorios, tests y documentación del esquema en el mismo cambio.

## 10. Seguridad

- No suba `.env`, tokens, claves privadas, credenciales o dumps.
- No registre headers de autorización, cookies LTI ni prompts con datos personales completos.
- Use argumentos estructurados al lanzar procesos; evite `shell: true` y concatenación de entradas.
- No ejecute scripts remotos sin versión/verificación.
- No mate procesos ajenos ni borre carpetas/volúmenes como recuperación automática.
- Ejecute Gitleaks conforme a [GITLEAKS.md](GITLEAKS.md).

Vulnerabilidades se comunican según [SECURITY.md](SECURITY.md), no mediante issues públicos con detalles explotables.

## 11. Documentación

Actualice documentación cuando cambie cualquiera de estos contratos:

- comandos y versiones;
- variables de entorno;
- puertos/URLs;
- modos del orquestador;
- estructura del monorepo;
- scopes o endpoints LTI;
- soporte de plataformas;
- estado de pruebas o producción.

No enlace informes privados ni prometa un comportamiento que no tenga evidencia reproducible.

## 12. Checklist de pull request

- [ ] Alcance pequeño y descripción del problema/decisión.
- [ ] Sin cambios ajenos ni artefactos generados.
- [ ] Archivos/funciones dentro de límites o excepción justificada.
- [ ] Prueba de regresión añadida o motivo explícito.
- [ ] Lint, tests y build ejecutados con resultado informado.
- [ ] Riesgos de migración, seguridad y rollback descritos.
- [ ] Documentación y ejemplos actualizados.
- [ ] Escaneo de secretos sin nuevos hallazgos.
