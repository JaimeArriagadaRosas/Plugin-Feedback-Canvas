# Guía de Contribución y Desarrollo (Onboarding)

¡Bienvenido al código fuente de **Plugin Feedback**! Este documento está diseñado para ayudarte a entender la estructura del proyecto y cómo puedes modificarlo o ejecutarlo en tu entorno local.

## 1. Arquitectura del Monorepo

Este proyecto utiliza una estructura de monorepo gestionada por los Workspaces de NPM. Esto significa que tenemos múltiples paquetes (frontend, backend, herramientas compartidas) dentro de un solo repositorio.

La estructura principal es la siguiente:

```text
Plugin Feedback/
├── apps/
│   ├── client/          # Frontend en React + Vite (Interfaz de usuario)
│   └── server/          # Backend en Node.js + Express (API y LTI Provider)
├── packages/
│   ├── logger/          # Utilidad compartida para logs (Pino)
│   └── shared/          # Tipos, utilidades y esquemas compartidos entre cliente y servidor
├── scripts/             # Scripts de orquestación, instalación y TLS
├── config/              # Configuraciones globales (ESLint, Prettier, etc.)
└── package.json         # Gestor del monorepo
```

## 2. Preparación del Entorno Local

> [!IMPORTANT]
> Recuerda que este proyecto **tiene las versiones congeladas**. Siempre debes usar `npm ci` para instalar dependencias. Evita usar `npm install` o `npm update` para prevenir errores de compatibilidad.

### Paso a paso:
1. Asegúrate de tener Node.js v18.
2. Clona el repositorio e ingresa a la carpeta `Plugin Feedback`.
3. Instala estrictamente las dependencias:
   ```bash
   npm ci
   ```
4. Configura el archivo `.env` (puedes usar `.env.example` como base).

## 3. Ejecución en Modo Desarrollo

Para trabajar en el código en tiempo real, puedes levantar el proyecto abriendo **dos consolas separadas**:

**Consola 1 (Backend):**
Levanta el servidor Express. Detectará cambios en tus archivos automáticamente gracias a Nodemon.
```bash
npm run server
```
*(El servidor estará disponible en `https://localhost:3000`)*

**Consola 2 (Frontend):**
Levanta el servidor de desarrollo de Vite para React. Tiene Hot-Module Replacement (HMR) activo.
```bash
npm run dev
```
*(El cliente estará disponible en `https://localhost:5173`)*

## 4. Estilos y Buenas Prácticas (Linting)

Este proyecto utiliza **ESLint** para mantener un código limpio y seguro. Antes de hacer un commit, asegúrate de que tu código cumpla con las reglas:

```bash
npm run lint
```

## 5. Pruebas Automatizadas (Testing)

El framework de pruebas elegido es **Vitest**. Escribe tus pruebas junto al componente o archivo que vas a probar con el sufijo `.test.js` o `.spec.js`.

Para ejecutar toda la batería de pruebas:
```bash
npm run test
```

Para mantener los tests corriendo en modo observación mientras programas:
```bash
npm run test:watch
```

## 6. Integración con Canvas LMS Local

Si necesitas probar el flujo LTI completo localmente, debes usar el script de instalación automática:
```bash
npm start
```
Y seleccionar la **Opción 3** para montar Canvas LMS a través de Docker.

> [!NOTE]
> Canvas local utiliza el dominio `canvas.docker` en el puerto `8443` (Proxy TLS). Recuerda mapear este dominio a `127.0.0.1` en tu archivo de hosts del sistema operativo. Puedes usar el comando `npm run setup:hosts` para ayudarte con esto.
