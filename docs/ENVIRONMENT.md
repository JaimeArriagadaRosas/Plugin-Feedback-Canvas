# Entorno de Ejecución (Estado Estable)

> [!WARNING]
> **ESTADO CONGELADO (FROZEN)**
> Este proyecto ha sido configurado deliberadamente para usar versiones exactas y fijas de todas sus dependencias y componentes externos. El objetivo es garantizar que siempre funcione exactamente igual, sin importar cuándo o dónde se instale en el futuro. **No actualices** ninguna librería sin realizar pruebas exhaustivas previas, ya que podrías romper la compatibilidad de la integración LTI o del LMS local.

## Requisitos Base del Sistema
Para garantizar la estabilidad del proyecto, necesitas:
*   **Node.js:** v22.x.x *(Imprescindible, versiones antiguas como la v18 causan problemas de compatibilidad con dependencias recientes).*
*   **Docker Desktop:** Configurado con al menos 8GB de RAM para soportar Canvas LMS.

## Versiones Ancladas (Hardcoded)

### 1. Canvas LMS
La plataforma base ya no apunta a la inestable rama \prod\, sino a un tag específico de versión validado:
*   **Versión:** \elease/2026-05-20.143\
*   *Nota:* Si utilizas el script de instalación automática (Opción 3), este se encargará de descargar y clonar esta versión exacta directamente desde el repositorio oficial de Instructure.

### 2. Ecosistema Node (Plugin Feedback)
El archivo \package.json\ (y todos los paquetes del monorepo en \pps\ y \packages\) han sido modificados para usar versiones exactas. Se eliminaron los prefijos \^\ y \~\.

Dependencias críticas (versiones exactas):
*   **React:** \18.2.0\
*   **Vite:** \8.1.5\ (en \devDependencies\)
*   **Zod:** \3.23.0\
*   **React Router Dom:** \7.17.0\
*   **TanStack Query:** \5.101.2\

## Instrucciones para una Instalación Segura

Para instalar el proyecto asegurándote de no descargar ninguna sub-dependencia más nueva de lo debido, **no uses \
pm install\**. Debes utilizar el comando de integración continua:

`ash
npm ci
`

Este comando ignorará cualquier intento de actualización e instalará exactamente las versiones fotografiadas en el archivo \package-lock.json\.

