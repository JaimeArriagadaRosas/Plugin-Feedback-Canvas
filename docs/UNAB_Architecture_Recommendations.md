# Recomendaciones Arquitectónicas LTI 1.3 para Canvas LMS (UNAB)

Este documento sintetiza las mejores prácticas de la industria y la documentación oficial de Instructure (creadores de Canvas LMS) para desplegar herramientas externas (LTI Advantage / LTI 1.3), con foco en las necesidades y escalabilidad para la Universidad Andrés Bello (UNAB).

## 1. Arquitectura de Dominio (Single Domain vs Separate Domains)

### **Recomendación: Arquitectura de Dominio Único (Single Domain)**
Para el despliegue del Plugin Feedback en la UNAB, es fuertemente recomendado utilizar un **único dominio** (por ejemplo, `https://feedback.unab.cl`) para servir tanto el Frontend (la interfaz de usuario) como el Backend (la API y manejador OIDC de LTI).

**¿Por qué lo recomienda la industria?**
- **Bloqueo de Cookies de Terceros (ITP):** Navegadores modernos como Safari (y próximamente Chrome) bloquean por defecto las cookies de terceros. Dado que el flujo LTI 1.3 carga tu plugin dentro de un `iframe` en Canvas (ej. `canvas.unab.cl`), si tu frontend y tu backend están en dominios diferentes (ej. `app.feedback.unab.cl` y `api.feedback.unab.cl`), el navegador bloqueará las cookies de sesión LTI (estado OIDC) considerándolas "cross-site", rompiendo la autenticación de la herramienta.
- **Simplificación de CORS:** Al compartir el mismo origen, se eliminan los complejos dolores de cabeza de configurar políticas estrictas de *Cross-Origin Resource Sharing* entre el Frontend y el Backend.

**Implementación técnica sugerida:**
Utilizar un proxy inverso (como **Nginx** o **Caddy**) configurado en el servidor principal que maneje el certificado SSL (HTTPS es obligatorio para LTI 1.3) y enrute el tráfico internamente:
- Las peticiones a la raíz `/` y estáticos sirvan el build de Vite (Frontend).
- Las peticiones a `/api/*` se enruten al puerto de Node.js (ej. `http://localhost:3000`), donde vive la lógica del servidor, el LTI Callback y el Auth handler.

---

## 2. Nivel de Instalación (Root Account vs Sub-Account)

Canvas permite instalar herramientas LTI a nivel de cuenta raíz (Root Account) o en subcuentas específicas (Sub-accounts).

### **Recomendación: Despliegue a nivel de Sub-cuenta (A menos que sea universal)**
- **Usa la Cuenta Raíz (Root Account)** SÓLO si este plugin de feedback es una política estricta y será utilizado por *todas las facultades y carreras de la UNAB sin excepción*.
- **Usa Sub-cuentas (Sub-accounts)** si el piloto de este plugin comenzará en una facultad específica (por ejemplo, Ingeniería). 

**Beneficios de usar Sub-cuentas (Best Practices):**
1. **Prevención de "Clutter" (Ruido visual):** Instalar herramientas a nivel raíz inunda los menús de navegación de profesores que jamás usarán la herramienta, generando confusión o requerimientos innecesarios a soporte técnico.
2. **Escalabilidad y Seguridad:** Al instalar a nivel de sub-cuenta, limitas el alcance de los permisos de la Developer Key (scopes) y de la lectura de la API a únicamente los cursos y alumnos que pertenecen a esa facultad.

*Nota: La configuración actual del plugin (`lti_placement.json`) utiliza de manera correcta `visibility: "admins"` en el `course_navigation`, lo que ya es una excelente práctica para evitar que los estudiantes vean el botón de administración del feedback.*

---

## 3. Seguridad LTI y Ciclo de Vida de los Tokens

La autenticación LTI 1.3 basa su robustez en el estándar OIDC y JWTs (JSON Web Tokens).
- **Public JWK URL (JSON Web Key):** La plataforma (Canvas) utiliza la URL del servidor LTI para consultar de forma dinámica las claves públicas y verificar la firma de los tokens enviados por la herramienta. La arquitectura debe asegurar que la ruta `/api/lti/jwks` tenga alta disponibilidad.
- **Gestión del "State" y "Nonce":** Durante el redireccionamiento OIDC (desde Canvas hacia el plugin, y de vuelta), la aplicación está obligada a generar y verificar parámetros `state` y `nonce` para prevenir ataques CSRF y ataques de repetición. La infraestructura debe soportar una caché compartida (o base de datos rápida, como Redis) si en el futuro se planea balancear la carga del backend entre múltiples instancias. Para una sola instancia en UNAB, el almacenamiento actual (Base de datos o memoria) es suficiente, siempre y cuando persista durante el flujo.
