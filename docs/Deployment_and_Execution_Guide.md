# Guía de Despliegue y Ejecución del Orquestador LTI 1.3

Este documento explica las nuevas configuraciones implementadas en el Plugin Feedback para asegurar su correcto despliegue, tolerancia a fallos en servidores de producción (AWS, etc.) y la correcta conexión LTI 1.3 con Canvas LMS.

## 1. El Menú del Orquestador (CLI)

El menú interactivo al ejecutar `npm start` ha sido rediseñado para separar de forma clara la instalación, la ejecución en producción y el desarrollo.

1.  **[1] Ejecutar Entorno de Producción LTI 1.3 (UNAB / Real Canvas):**
    Esta opción es para el "Día a Día". Asume que el archivo `.env` ya fue configurado (ya tienes el Client ID y demás credenciales).
    En este modo, ya no se utiliza el servidor de desarrollo `Vite`. En su lugar, el Backend de Node.js arranca y sirve los archivos compilados del Frontend (`dist`). Está optimizado para alto rendimiento y concurrencia.
2.  **[2] Setup / Despliegue de Plugin LTI (Automatizado):**
    Solo se ejecuta una vez (o si hay que migrar de servidor). Consiste en un asistente interactivo que:
    *   Pregunta la URL de Canvas, tu Dominio, y un API Token (para autoconfigurar todo) o alternativamente permite ingresar una Developer Key manual si la institución ya te entregó una.
    *   Registra la herramienta en la cuenta de Canvas (Root o Sub-cuenta).
    *   Habilita la herramienta y actualiza automáticamente el `.env`.
3.  **[3] Ejecutar localmente Canvas LMS:**
    Desarrollo puro. Levanta el ecosistema Docker local para no tener que depender de la conexión a internet.
4.  **[4] Modo Standalone / Pruebas de API:**
    Útil para el equipo de desarrollo. Si quieres probar el UI o la lógica de BD sin pasar por el largo flujo de autenticación LTI OIDC, puedes pegar un API Token en consola y fingir ser un profesor en un curso específico.
5.  **[5] Validaciones de Caja Negra:**
    Suite de "Health Checks". Verifica que los componentes, la API, y el entorno estén sanos antes de que el plugin reciba usuarios reales.

## 2. Ejecución 24/7 en Servidores (Amazon AWS / VPS)

Para alojar el plugin y recibir tráfico de cientos o miles de alumnos en producción, **no debes usar la consola abierta con `npm start`**. 
Si el servidor de Node se interrumpe, el plugin se caerá hasta que alguien lo levante a mano.

### La solución: Gestores de Procesos (PM2)

Para un entorno robusto, recomendamos compilar y delegar la ejecución a un gestor de procesos:

```bash
# 1. Compila el frontend por primera y única vez
npm run build

# 2. Inicia el orquestador forzando el Modo 1 de Producción mediante PM2
# Primero, asegúrate de que PM2 está instalado: npm install -g pm2
NON_INTERACTIVE=true STARTUP_MODE=1 pm2 start packages/server/src/index.js --name "plugin-feedback"

# 3. Guarda la configuración para que el plugin arranque solo si el servidor (AWS) se reinicia
pm2 save
pm2 startup
```

Con este flujo, PM2 monitorea el backend. Si llega a existir un error en tiempo de ejecución, PM2 reiniciará el plugin en un parpadeo, brindando total tolerancia a fallos.

## 3. Configuración de Red: Single Domain Architecture

Uno de los mayores causantes de errores de "Acceso Denegado" en LTI 1.3 es el bloqueo de Cookies de Terceros. Puesto que Canvas inyecta el Plugin mediante un `iframe`, navegadores modernos bloquean cualquier intento del plugin de guardar cookies (sesiones LTI) si el origen de Canvas (`canvas.universidad.edu`) difiere drásticamente del origen de la herramienta, e incluso si el Frontend y Backend del plugin difieren entre sí.

**La Regla de Oro:**
Frontend y Backend deben vivir en el **mismo origen público** (Single Domain).

Ejemplo de configuración proxy (Nginx):
```nginx
server {
    listen 443 ssl;
    server_name feedback.unab.cl;

    # Certificados SSL...

    # El Frontend estático (compilado por Vite)
    location / {
        root /var/www/plugin-feedback/packages/client/dist;
        try_files $uri /index.html;
    }

    # El Backend de Node.js (Puerto 3000)
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_addrs;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
De esta manera, toda la comunicación fluye en `https://feedback.unab.cl`, manteniendo los flujos OIDC LTI limpios de advertencias de seguridad en los navegadores y simplificando el CORS.
