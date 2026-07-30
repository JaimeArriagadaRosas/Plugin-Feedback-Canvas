# Registro de Decisiones Arquitectónicas (ADR)

Este archivo (basado en el patrón *Architecture Decision Records*) documenta el **"por qué"** de las decisiones técnicas más importantes del proyecto. Su objetivo es evitar que futuros desarrolladores intenten cambiar un componente sin conocer el contexto histórico que motivó su creación.

## ADR 1: Uso de Proxy TLS Inverso en Localhost

*   **Estado:** Aceptado
*   **Contexto:** Canvas LMS exige conexiones completamente seguras (HTTPS) para las herramientas externas conectadas mediante LTI 1.3. Si Canvas se ejecuta localmente mediante Docker (puerto 8080, HTTP) y el plugin se sirve en HTTPS (puerto 3000), los navegadores modernos bloquean la interacción por políticas de *Mixed Content* y *Cross-Origin*.
*   **Decisión:** Se optó por construir y orquestar un Proxy TLS Inverso en Node.js (escuchando en el puerto 8443) que envuelve el tráfico de Canvas.
*   **Consecuencia:** Todos los usuarios locales deben acceder a Canvas a través de `https://localhost:8443` o `https://canvas.docker:8443`. Esto agrega una capa extra en el entorno local pero garantiza que el flujo LTI funcione idéntico a producción.

## ADR 2: Congelamiento de Dependencias y Versiones (Agosto 2024)

*   **Estado:** Aceptado
*   **Contexto:** El ciclo de vida de mantenimiento activo del proyecto terminará a finales de año. Para evitar que actualizaciones inesperadas en el ecosistema Node.js o en el repositorio base de Canvas LMS rompan el sistema.
*   **Decisión:** 
    1.  Fijar estrictamente todas las dependencias en los archivos `package.json` eliminando los operadores de versión dinámica (`^`, `~`).
    2.  Forzar al script de clonación (`CanvasCloner.js`) a apuntar a la release oficial `release/2026-05-20.143` en lugar de la rama dinámica `prod`.
*   **Consecuencia:** El código es completamente estable en el tiempo y predecible. Se debe utilizar estrictamente `npm ci` para instalar paquetes. Actualizar librerías requerirá un esfuerzo manual y pruebas de regresión.

## ADR 3: Monorepo con NPM Workspaces

*   **Estado:** Aceptado
*   **Contexto:** El proyecto tiene un frontend (React) y un backend (Express) que comparten modelos de datos, validaciones y tipos.
*   **Decisión:** Utilizar NPM Workspaces en un único repositorio en lugar de repositorios separados.
*   **Consecuencia:** Facilita el intercambio de código (a través del workspace `packages/shared`). Simplifica el proceso de clonación e instalación (`npm install` instala todo a la vez), pero requiere que los comandos del terminal estén correctamente orquestados.

## ADR 4: Elección del Motor de IA (Google Gemini)

*   **Estado:** Aceptado
*   **Contexto:** Se necesitaba generar retroalimentación académica adaptativa basada en reglas y contexto del estudiante.
*   **Decisión:** Se integró el modelo fundacional de Google (Gemini) debido a su gran ventana de contexto, velocidad de procesamiento para textos largos, y coste-beneficio en el API.
*   **Consecuencia:** El sistema depende del servicio en la nube de Google, requiriendo siempre conectividad y una clave API válida (`GEMINI_API_KEY`) definida en las variables de entorno.
