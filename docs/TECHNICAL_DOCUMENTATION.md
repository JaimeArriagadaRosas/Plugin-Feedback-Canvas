# Plugin de Feedback Adaptativo - Documentación Técnica

## 📋 Índice

1. [Visión General](#visión-general)
2. [Arquitectura](#arquitectura)
3. [Requerimientos Implementados](#requerimientos-implementados)
4. [Instalación y Despliegue](#instalación-y-despliegue)
5. [Configuración](#configuración)
6. [API Reference](#api-reference)
7. [Integración con Canvas LMS](#integración-con-canvas-lms)
8. [Seguridad](#seguridad)
9. [Mantenimiento](#mantenimiento)
10. [Solución de Problemas](#solución-de-problemas)

---

## Visión General

Plugin LTI 1.3 para Canvas LMS que genera retroalimentación automática y personalizada usando IA. Desarrollado para la Unidad de Investigación Docente y Desarrollo Académico (UNIDA) de la Universidad Andrés Bello.

### Características principales

- ✅ Generación automática de feedback con IA (GPT-4, Claude, Gemini)
- ✅ Personalización basada en historial académico
- ✅ 3 rangos de calificación: Excelente (≥6.0), Satisfactorio (4.0-5.9), Necesita Mejorar (<4.0)
- ✅ Panel de revisión y aprobación para profesores
- ✅ Plantillas editables con variables dinámicas
- ✅ Notificaciones automáticas a estudiantes
- ✅ Reportes y estadísticas en tiempo real
- ✅ Rol-based access control
- ✅ Compatible con LTI 1.3
- ✅ Dockerizado para despliegue fácil

---

## Arquitectura

### Stack Tecnológico

| Componente | Tecnología |
|-----------|------------|
| **Backend** | Node.js + Express |
| **Frontend** | React 18 |
| **Base de Datos** | PostgreSQL 15 + Sequelize ORM |
| **Cache** | Redis |
| **LTI** | LTI 1.3 con OAuth 2.0 |
| **IA** | OpenAI GPT-4 / Anthropic Claude / Google Gemini |
| **Contenedores** | Docker + Docker Compose |
| **Web Server** | Nginx (frontend) |

### Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        Canvas LMS (Instancia)                   │
├─────────────────────────────────────────────────────────────────┤
│  SpeedGrader → LTI 1.3 Launch → Plugin Iframe                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                    ┌────────▼────────┐
                    │   Nginx (Frontend)   │
                    │  Puerto 3000         │
                    └────────┬────────┘
                             │ Proxy /api/ → Backend
                    ┌────────▼────────┐
                    │  Express API    │
                    │  Puerto 3001    │
                    ├────────────────┤
                    │ • LTI Middleware│
                    │ • Auth          │
                    │ • Business Logic│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
        │ PostgreSQL │ │   Redis   │ │ LLM APIs  │
        │ (Datos)    │ │ (Cache)   │ │ (IA)      │
        └────────────┘ └───────────┘ └───────────┘
```

### Estructura del Proyecto

```
github/
├── backend/
│   ├── config/           # Configuraciones (db, lti, ai)
│   │   ├── database.js
│   │   ├── lti.js
│   │   └── ai.js
│   ├── models/           # Modelos Sequelize
│   │   ├── index.js
│   │   ├── User.js
│   │   ├── Course.js
│   │   ├── Assignment.js
│   │   ├── Template.js
│   │   ├── Feedback.js
│   │   ├── PersonalizationVar.js
│   │   ├── CourseAssignmentConfig.js
│   │   ├── NotificationLog.js
│   │   ├── AuditLog.js
│   │   └── AIConfig.js
│   ├── routes/           # Endpoints API
│   │   ├── lti.js
│   │   ├── feedback.js
│   │   ├── templates.js
│   │   ├── admin.js
│   │   ├── courses.js
│   │   └── reports.js
│   ├── services/         # Lógica de negocio
│   │   ├── aiService.js
│   │   ├── canvasService.js
│   │   └── feedbackService.js
│   ├── middleware/       # Middleware Express
│   │   ├── lti.js
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── scripts/          # Scripts de deployment
│   │   ├── install.sh
│   │   └── install.bat
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LTiContext.jsx
│   │   │   ├── CanvasThemeWrapper.jsx
│   │   │   ├── SpeedGraderPanel.jsx
│   │   │   ├── FeedbackCard.jsx
│   │   │   ├── TemplateManager.jsx
│   │   │   ├── AdminPanel.jsx
│   │   │   ├── ReportsPanel.jsx
│   │   │   ├── StudentView.jsx
│   │   │   └── SidebarNavigation.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── styles/
│   │   │   ├── canvas-theme.css
│   │   │   └── main.css
│   │   ├── App.js
│   │   └── index.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker/
│   ├── docker-compose.yml
│   └── init.sql
├── docs/
│   └── TECHNICAL_DOCUMENTATION.md
├── .env.example
├── .env.docker
├── README.md
└── AGENTS.md
```

---

## Requerimientos Implementados

### Requerimientos Funcionales Completos

#### Generación de Feedback con IA (RF01-RF08) ✅
- [x] RF01: Generación automática con IA basada en calificación y plantilla
- [x] RF02: Considera calificaciones previas del estudiante
- [x] RF03: Mensajes diferenciados por rango (≥6.0, 4.0-5.9, <4.0)
- [x] RF04: Modelo de lenguaje configurable (GPT-4, Claude, Gemini)
- [x] RF05: Feedback distinto según trayectoria académica previa
- [x] RF06: Agregar variables de personalización sin afectar lógica
- [x] RF07: Captura de ediciones del profesor para mejorar modelo
- [x] RF08: Calificación de calidad del feedback (1-5 estrellas)

#### Gestión de Plantillas (RF09-RF15) ✅
- [x] RF09: CRUD de plantillas por rango de calificación
- [x] RF10: Editor con variables dinámicas
- [x] RF11: Modificación con tracking de cambios
- [x] RF12: Eliminación con confirmación
- [x] RF13: Historial de plantillas con metadatos
- [x] RF14: Duplicación de plantillas
- [x] RF15: Validación de completitud por rangos

#### Integración Canvas LTI 1.3 (RF16-RF22) ✅
- [x] RF16: Integración en SpeedGrader como panel lateral
- [x] RF17: Inserción como comentario de rúbrica
- [x] RF18: Autenticación OAuth 2.0 LTI 1.3
- [x] RF19: Respeto de roles Canvas
- [x] RF20: Consumo API REST Canvas
- [x] RF21: API REST propia con OAuth 2.0
- [x] RF22: Sincronización automática de libro de calificaciones

#### Panel de Revisión Profesor (RF23-RF30) ✅
- [x] RF23: Lista de pendientes filtrable
- [x] RF24: Vista detallada con contexto
- [x] RF25: Editor de texto enriquecido
- [x] RF26: Aprobación con registro
- [x] RF27: Rechazo y solicitud de regeneración
- [x] RF28: Aprobación masiva
- [x] RF29: Notas privadas
- [x] RF30: Etiquetas visuales de estado

#### Vista del Estudiante (RF31-RF33) ✅
- [x] RF31: Visualización como comentario de rúbrica
- [x] RF32: Historial cronológico
- [x] RF33: Mecanismo de utilidad (sí/no + escala 1-5)

#### Variables de Personalización (RF34-RF37) ✅
- [x] RF34: Configuración por curso
- [x] RF35: Activación/desactivación individual
- [x] RF36: Persistencia por sesión
- [x] RF37: Asignación de ponderación (suma=100%)

#### Gestión de Cursos/Asignaciones (RF38-RF41) ✅
- [x] RF38: Selección de curso Canvas
- [x] RF39: Listado de asignaciones evaluables
- [x] RF40: Activación/desactivación por asignación
- [x] RF41: Detección automática de nuevas calificaciones

#### Notificaciones (RF42-RF45) ✅
- [x] RF42: Notificación in-app Canvas automática
- [x] RF43: Configuración de método preferido
- [x] RF44: Registro de historial
- [x] RF45: Indicador visual de pendientes

#### Reportes y Estadísticas (RF46-RF50) ✅
- [x] RF46: Contabilización por curso/asignación
- [x] RF47: Porcentajes en tiempo real
- [x] RF48: Exportación PDF/Excel
- [x] RF49: Gráficos de distribución
- [x] RF50: Estadísticas de utilidad

#### Administración (RF51-RF57) ✅
- [x] RF51: Sistema de roles heredado Canvas
- [x] RF52: Modificación dinámica de permisos
- [x] RF53: Log de auditoría
- [x] RF54: Log de seguridad
- [x] RF55: Configuración variables IA
- [x] RF56: Capa de abstracción LLM
- [x] RF57: Gestión segura de tokens

#### Instalación/Despliegue (RF58-RF60) ✅
- [x] RF58: Instalador documentado para Docker
- [x] RF59: Registro automático LTI
- [x] RF60: Script de migración BD

#### Accesibilidad/Soporte (RF61-RF64) ✅
- [x] RF61: Identificación de 4+ tipos de error
- [x] RF62: Modo manual como respaldo
- [x] RF63: Historial persistente
- [x] RF64: Modo solo lectura

### Requerimientos No Funcionales

| # | Requisito | Estado | Nota |
|---|-----------|--------|------|
| RNF01 | <3s generación feedback | ✅ | Implementado con cache |
| RNF02 | <2s navegación | ✅ | Optimizado |
| RNF03 | Arquitectura stateless | ✅ | Express stateless |
| RNF04 | Disponibilidad horario académico | ✅ | Docker ensures uptime |
| RNF05 | AES-256 + TLS 1.3 | ⚠️ | TLS handled by nginx |
| RNF06 | Cumplimiento Ley 21.719 | ⚠️ | Data handling ready |
| RNF07 | RBAC por solicitud | ✅ | LTI middleware |
| RNF08 | Interfaz limpia Canvas | ✅ | Theme CSS |
| RNF09 | Responsive 1024x768 | ✅ | CSS responsive |
| RNF10 | WCAG 2.1 AA | ⚠️ | Needs audit |
| RNF11 | Mensajes claros | ✅ | ErrorHandler |
| RNF12 | Retroalimentación visual | ✅ | Spinners |
| RNF13 | Compatibilidad Canvas API | ✅ | CanvasService |
| RNF14 | Validación LTI 1.3 | ⚠️ | Needs conformance test |
| RNF15 | Documentación técnica | ✅ | Este archivo |
| RNF16 | Arquitectura modular | ✅ | Express routers |
| RNF17 | Linting y estilo | ⚠️ | ESLint config pending |
| RNF18 | Escalabilidad horizontal | ⚠️ | Stateless designed |
| RNF19 | Sin degradación | ⚠️ | Indexes needed |
| RNF20 | Navegadores modernos | ✅ | ES6+ |
| RNF21 | HTML5/CSS3 | ✅ | Semantic HTML |
| RNF22 | PostgreSQL (no NoSQL) | ✅ | Sequelize |
| RNF23 | Compatible cualquier Canvas LTI | ✅ | Standard LTI |

**Leyenda:** ✅ Completado | ⚠️ Parcial | ❌ Pendiente

---

## Instalación y Despliegue

### Requisitos Previos

```bash
# Software necesario
- Docker 20.10+
- Docker Compose 2.0+
- Git
- (Opcional) Node.js 18+ para desarrollo local
```

### Instalación Rápida (Docker)

```bash
# 1. Clonar repositorio
git clone <repository-url>
cd github

# 2. Configurar variables de entorno
cp .env.example .env
nano .env   # Editar con tus valores

# 3. Generar claves LTI (opcional, Docker puede generarlas)
openssl genrsa -out lti_private.pem 2048
openssl rsa -pubout -in lti_private.pem -out lti_public.pem

# 4. Instalar
chmod +x scripts/install.sh
./scripts/install.sh

# O en Windows:
scripts\install.bat
```

### Instalación Manual (desarrollo local)

```bash
# Backend
cd backend
npm install
cp .env.example .env
npm run dev   # en desarrollo

# Frontend
cd frontend
npm install
npm start     # http://localhost:3000
```

### Verificar Instalación

```bash
# Salud de servicios
curl http://localhost:3001/health

# Ver logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Acceso a Servicios

| Servicio | URL | Credenciales |
|----------|-----|--------------|
| Frontend Plugin | http://localhost:3000 | vía Canvas LTI |
| Backend API | http://localhost:3001 | Bearer token |
| Base de Datos | localhost:5432 | feedback_user |
| pgAdmin | http://localhost:5050 | admin@unab.cl / admin123 |

---

## Configuración

### Variables de Entorno (.env)

```bash
# Aplicación
NODE_ENV=production
PORT=3001
JWT_SECRET=tu-secret-generado-con-openssl-rand-base64-32

# Base de datos (auto-generado por Docker)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=feedback_plugin
DB_USER=feedback_user
DB_PASSWORD=

# Canvas (tu instancia)
CANVAS_URL=https://canvas.unab.cl
TOOL_URL=https://feedback.unab.cl
FRONTEND_URL=https://feedback.unab.cl

# Claves LTI (generadas)
LTI_CLIENT_ID=feedback-plugin-client
LTI_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."

# Provedores IA (elige uno o más)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

AI_PROVIDER=openai
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=500
```

### Configuración LTI en Canvas

1. **Navegar a**: Admin → Configuración de la cuenta → Apps → + App
2. **Tipo**: "Por URL de Configuración"
3. **URL de configuración**: `http://localhost:3001/lti/jwks`
4. **Clave de cliente**: `feedback-plugin-client`
5. **URL de redirección**: `http://localhost:3001/lti/launch`
6. **Asignación de claves de privacidad**: ✔ Habilitar
7. **Guardar**

Luego, en **Tool/External App Configuration**:
- Nombre: "Feedback Adaptativo UNIDA"
- Consumer Key: igual a Client ID
- Shared Secret: cualquier (no se usa en LTI 1.3)

**Importante**: Para producción, registra las claves RSA generadas en los campos correspondientes.

### Configuración de Plantillas

1. Como profesor, entra a un curso con SpeedGrader
2. El plugin aparecerá en el sidebar
3. Ve a la pestaña "Plantillas"
4. Crea 3 plantillas (una por rango: ≥6.0, 4.0-5.9, <4.0)
5. Usa variables: `{{nombre_estudiante}}`, `{{calificacion}}`, `{{promedio_curso}}`

---

## API Reference

### Endpoints Principales

#### LTI
```
POST   /lti/launch          - LTI launch endpoint
GET    /lti/jwks            - Public keyset
GET    /lti/login           - OIDC initiation
```

#### Feedback
```
POST   /api/feedback/generate       - Generar feedback
GET    /api/feedback/pending        - Listar pendientes
GET    /api/feedback/:id            - Obtener detalle
PUT    /api/feedback/:id/edit       - Editar texto
POST   /api/feedback/:id/approve    - Aprobar y enviar
POST   /api/feedback/:id/reject     - Rechazar
POST   /api/feedback/:id/rate       - Calificar utilidad (estudiante)
POST   /api/feedback/batch-approve  - Aprobación masiva
```

#### Templates
```
GET    /api/templates               - Listar plantillas
POST   /api/templates               - Crear
PUT    /api/templates/:id           - Actualizar
DELETE /api/templates/:id           - Eliminar
POST   /api/templates/:id/duplicate - Duplicar
GET    /api/templates/validate-complete/:courseId
```

#### Admin
```
GET    /api/admin/ai-config         - Config IA
PUT    /api/admin/ai-config/:key    - Actualizar IA
GET    /api/admin/roles             - Roles y permisos
GET    /api/admin/audit-logs        - Logs de auditoría
GET    /api/admin/health            - Salud del sistema
```

#### Courses
```
GET    /api/courses/courses         - Cursos del profesor
GET    /api/courses/:courseId/assignments  - Asignaciones
POST   /api/courses/assignments/:id/config - Configurar plugin
GET    /api/courses/:courseId/personalization - Variables
PUT    /api/courses/:courseId/personalization - Actualizar variables
```

#### Reports
```
GET    /api/reports/dashboard/:courseId/:assignmentId?
GET    /api/reports/export/:courseId?format=csv|json
GET    /api/reports/grade-distribution/:courseId
GET    /api/reports/utility-stats/:courseId
```

---

## Integración con Canvas LMS

### Flujo LTI 1.3

```
1. Profesor abre SpeedGrader en Canvas
2. Canvas → Plugin: LTI launch (POST con id_token)
3. Plugin valida JWT (iss, aud, nonce, exp)
4. Plugin crea/actualiza usuario local
5. Plugin genera token de sesión
6. Frontend carga con contexto (course_id, assignment_id)
```

### Inserción de Feedback en Canvas

El feedback aprobado se inserta como comentario en la rúbrica:

```javascript
// Uso de Canvas API
PUT /api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id/comments
{
  "comment": {
    "text_comment": "Contenido del feedback generado...",
    "hidden": false
  }
}
```

---

## Seguridad

### Implementada

- ✅ LTI 1.3 con OAuth 2.0 y JWT
- ✅ Validación de firma de tokens
- ✅ CSRF protection via SameSite cookies
- ✅ Helmet.js headers
- ✅ Rate limiting (Redis + memory fallback)
- ✅ SQL injection protection (Sequelize ORM)
- ✅ XSS protection (React escaping)
- ✅ RBAC por rol Canvas
- ✅ Audit logging

### Pendiente (Recomendado)

- 🔄 Encriptación AES-256 para datos sensibles en BD
- 🔄 Cifrado de API keys en vault externo
- 🔄 Cumplimiento Ley 21.719 total (consentimiento, anonimización)
- 🔄 Penetration testing
- 🔄 WCAG 2.1 AA audit completo

---

## Mantenimiento

### Logs

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Solo backend
docker-compose logs -f backend

# Rotación automática (configurable en docker-compose)
```

### Backup Base de Datos

```bash
# Manual
docker-compose exec postgres pg_dump -U feedback_user feedback_plugin > backup.sql

# Automatizado (cron)
0 2 * * * cd /path/to/github && ./scripts/backup.sh
```

### Actualizar Dependencias

```bash
# Backend
cd backend
npm audit fix
npm update

# Frontend  
cd frontend
npm audit fix
```

### Monitoreo

- Health check: `GET /health`
- Metricas Prometheus: pendiente
- Alertas: configurar en Docker Compose

---

## Solución de Problemas

### Error: "Invalid token"
**Causa**: JWT mal formado o expirado
**Solución**: Recargar desde Canvas

### Error: "AI service unavailable"
**Causa**: API key no configurada o servicio caído
**Solución**: Verificar .env, usar modo mock (ENABLE_MOCK_FALLBACK=true)

### No aparece el plugin en SpeedGrader
**Causa**: LTI no configurado en Canvas
**Solución**: Seguir pasos de "Configuración LTI en Canvas"

### Templates no cargan
**Causa**: DB no migrada
**Solución**: `docker-compose exec backend npm run migrate`

### 403 Forbidden
**Causa**: Rol sin permisos
**Solución**: Verificar rol en Canvas (debe ser Teacher o Admin)

---

## Soporte

- **Documentación**: https://github.com/unab/feedback-plugin
- **Issues**: https://github.com/unab/feedback-plugin/issues
- **Contacto**: unida@unab.cl

---

*Última actualización: 2026-04-29*
*Versión: 1.0.0*
