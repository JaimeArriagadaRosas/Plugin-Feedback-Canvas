-- Esquema de Base de Datos para el Plugin de Feedback (PostgreSQL)
-- Normalizado según estándares PostgreSQL 2024-2025
-- BIGINT GENERATED ALWAYS AS IDENTITY, TIMESTAMPTZ, ENUMs, FKs indexadas, triggers, soft deletes

-- ==============================
-- TIPOS Y FUNCIONES BASE
-- ==============================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ENUMs para estados (type-safe)
DO $$ BEGIN
  CREATE TYPE feedback_estado AS ENUM ('PENDIENTE','EDITADO','APROBADO','ENVIADO','RECHAZADO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE usuario_rol AS ENUM ('admin','teacher','student');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==============================
-- 0. PERMISOS POR ROL
-- ==============================
CREATE TABLE IF NOT EXISTS Permisos_Rol (
    rol usuario_rol PRIMARY KEY,
    permisos JSONB NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS permisos_rol_updated_at ON Permisos_Rol;
CREATE TRIGGER permisos_rol_updated_at
  BEFORE UPDATE ON Permisos_Rol
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================
-- 0.5. METADATOS DEL PROFESOR
-- ==============================
CREATE TABLE IF NOT EXISTS Profesor_Metadata (
    profesor_id VARCHAR(50) PRIMARY KEY,
    has_seeded_templates BOOLEAN DEFAULT FALSE,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- 1. TABLA DE PLANTILLAS DE FEEDBACK
-- ==============================
CREATE TABLE IF NOT EXISTS Plantilla_Feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL,
    contenido TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    profesor_id VARCHAR(50),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS plantilla_feedback_updated_at ON Plantilla_Feedback;
CREATE TRIGGER plantilla_feedback_updated_at
  BEFORE UPDATE ON Plantilla_Feedback
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================
-- 2. HISTORIAL DE FEEDBACKS GENERADOS
-- ==============================
CREATE TABLE IF NOT EXISTS Historial_Feedback_Generado (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    profesor_id TEXT NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    tarea_id VARCHAR(50) NOT NULL,
    nombre_curso VARCHAR(255),
    nombre_tarea VARCHAR(255),
    nombre_estudiante VARCHAR(255),
    plantilla_id BIGINT REFERENCES Plantilla_Feedback(id) ON DELETE SET NULL,
    contenido_generado TEXT NOT NULL,
    prompt_usado TEXT,
    nota_canvas INTEGER,
    nota_chile NUMERIC(3,1),
    aprobado BOOLEAN,
    estado feedback_estado DEFAULT 'PENDIENTE',
    calificacion_profesor INTEGER,
    calificacion_estudiante INTEGER,
    nota_privada TEXT,
    fecha_generacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_estudiante ON Historial_Feedback_Generado(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_historial_profesor ON Historial_Feedback_Generado(profesor_id);
CREATE INDEX IF NOT EXISTS idx_historial_curso ON Historial_Feedback_Generado(curso_id);
CREATE INDEX IF NOT EXISTS idx_historial_plantilla_id ON Historial_Feedback_Generado(plantilla_id);

-- ==============================
-- 3. CONFIGURACIONES POR CURSO Y ASIGNACIÓN
-- ==============================
CREATE TABLE IF NOT EXISTS Configuracion_Curso_Tarea (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contexto_tipo VARCHAR(20) NOT NULL,
    contexto_id VARCHAR(50) NOT NULL,
    config_json JSONB NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contexto_tipo, contexto_id)
);

DROP TRIGGER IF EXISTS config_curso_tarea_updated_at ON Configuracion_Curso_Tarea;
CREATE TRIGGER config_curso_tarea_updated_at
  BEFORE UPDATE ON Configuracion_Curso_Tarea
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================
-- 4. TOKENS Y LLAVES DE API DE SERVICIOS IA
-- ==============================
CREATE TABLE IF NOT EXISTS Llaves_API_IA (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    servicio VARCHAR(50) NOT NULL UNIQUE,
    api_key_encriptada TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    ultima_verificacion TIMESTAMPTZ
);

ALTER TABLE Llaves_API_IA ADD COLUMN IF NOT EXISTS endpoint_personalizado VARCHAR(2048);

-- ==============================
-- 5. HISTORIAL ACADÉMICO DE ESTUDIANTES (CACHE LOCAL)
-- ==============================
CREATE TABLE IF NOT EXISTS Historial_Academico_Local (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    resumen_desempeno JSONB,
    ultimo_sync TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(estudiante_id, curso_id)
);

-- ==============================
-- 6. LOGS DE AUDITORÍA
-- ==============================
CREATE TABLE IF NOT EXISTS Logs_Auditoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalle TEXT,
    ip_address VARCHAR(45),
    fecha TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_usuario ON Logs_Auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_fecha ON Logs_Auditoria(fecha);

-- ==============================
-- 7. HISTORIAL DE NOTIFICACIONES
-- ==============================
CREATE TABLE IF NOT EXISTS Notificaciones_Feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    feedback_id BIGINT NOT NULL REFERENCES Historial_Feedback_Generado(id),
    mensaje TEXT NOT NULL,
    metodo VARCHAR(20) DEFAULT 'email',
    enviado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_feedback ON Notificaciones_Feedback(feedback_id);

-- ==============================
-- 7.1 NOTIFICACIONES DE SISTEMA (ERRORES GLOBALES RF61)
-- ==============================
CREATE TABLE IF NOT EXISTS notificaciones_sistema (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profesor_id VARCHAR(50) NOT NULL,
    tipo_error VARCHAR(50) NOT NULL,
    mensaje_error TEXT,
    detalle TEXT,
    contexto JSONB,
    leido BOOLEAN DEFAULT FALSE,
    resuelto BOOLEAN DEFAULT FALSE,
    fecha TIMESTAMPTZ DEFAULT NOW(),
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_sistema_profesor ON notificaciones_sistema(profesor_id);
CREATE INDEX IF NOT EXISTS idx_notif_sistema_tipo ON notificaciones_sistema(tipo_error);
CREATE INDEX IF NOT EXISTS idx_notif_sistema_leido ON notificaciones_sistema(leido);

-- ==============================
-- 7.5 PREFERENCIAS DE NOTIFICACION (ESTUDIANTES)
-- ==============================
CREATE TABLE IF NOT EXISTS Preferencias_Notificacion_Estudiante (
    estudiante_id VARCHAR(50) PRIMARY KEY,
    metodo VARCHAR(20) DEFAULT 'canvas_inapp', -- Opciones: 'canvas_inapp', 'email', 'none'
    frecuencia VARCHAR(20) DEFAULT 'inmediata', -- Opciones: 'inmediata', 'diario'
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS pref_notif_estud_updated_at ON Preferencias_Notificacion_Estudiante;
CREATE TRIGGER pref_notif_estud_updated_at
  BEFORE UPDATE ON Preferencias_Notificacion_Estudiante
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tabla de idempotencia de webhooks de Canvas
CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_hash VARCHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    attempts INTEGER DEFAULT 1,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_hash ON webhook_events(event_hash);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);

CREATE TABLE IF NOT EXISTS webhook_dead_letter (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_hash VARCHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB,
    last_error TEXT,
    attempts INTEGER,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================
-- 8. CONFIGURACIÓN GLOBAL DE IA
-- ==============================
CREATE TABLE IF NOT EXISTS Configuracion_IA (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modelo_preferido VARCHAR(50) DEFAULT 'gemini-1.5-flash',
    prompt_base TEXT,
    temperatura NUMERIC(3,2),
    longitud_maxima INTEGER,
    endpoint_api TEXT,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS config_ia_updated_at ON Configuracion_IA;
CREATE TRIGGER config_ia_updated_at
  BEFORE UPDATE ON Configuracion_IA
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================
-- 9. CONFIGURACIÓN POR ASIGNACIÓN
-- ==============================
CREATE TABLE IF NOT EXISTS configuracion_asignacion (
    id_configuracion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    canvas_course_id VARCHAR(50) NOT NULL,
    canvas_assignment_id VARCHAR(50) NOT NULL,
    feedback_activo BOOLEAN DEFAULT FALSE,
    plantilla_id BIGINT REFERENCES Plantilla_Feedback(id) ON DELETE SET NULL,
    profesor_id TEXT NOT NULL,
    fecha_modificacion TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(canvas_course_id, canvas_assignment_id)
);

DROP TRIGGER IF EXISTS config_asignacion_updated_at ON configuracion_asignacion;
CREATE TRIGGER config_asignacion_updated_at
  BEFORE UPDATE ON configuracion_asignacion
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================
-- 10. VARIABLES CONFIGURADAS POR ASIGNACIÓN
-- ==============================
CREATE TABLE IF NOT EXISTS variables_asignacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    configuracion_id BIGINT NOT NULL REFERENCES configuracion_asignacion(id_configuracion),
    variable_id VARCHAR(50) NOT NULL,
    variable_activa BOOLEAN DEFAULT FALSE,
    ponderacion NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_variables_asignacion_config ON variables_asignacion(configuracion_id);

-- ==============================
-- FASE 1: TABLA DE USUARIOS LOCALES (modo desarrollo)
-- ==============================
CREATE TABLE IF NOT EXISTS usuarios_local (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    rol usuario_rol NOT NULL,
    estudiante_index INTEGER NULL,
    canvas_user_id TEXT NOT NULL,
    canvas_user_uuid UUID NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_local_email ON usuarios_local(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_local_rol ON usuarios_local(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_local_canvas_user_id ON usuarios_local(canvas_user_id);

DROP TRIGGER IF EXISTS usuarios_local_updated_at ON usuarios_local;
CREATE TRIGGER usuarios_local_updated_at
  BEFORE UPDATE ON usuarios_local
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================
-- FASE 5: MAPEO LTI PARA CONTINUIDAD
-- ==============================
CREATE TABLE IF NOT EXISTS user_lti_mappings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    local_user_id BIGINT NOT NULL REFERENCES usuarios_local(id),
    canvas_sub TEXT NOT NULL,
    canvas_uuid UUID NULL,
    deployment_id TEXT NOT NULL,
    issuer TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(local_user_id, deployment_id, issuer)
);

CREATE INDEX IF NOT EXISTS idx_user_lti_mappings_canvas_sub ON user_lti_mappings(canvas_sub);
CREATE INDEX IF NOT EXISTS idx_user_lti_mappings_deployment ON user_lti_mappings(deployment_id, issuer);

-- ==============================
-- 12. CANVAS USER TOKENS (OAuth2)
-- ==============================
CREATE TABLE IF NOT EXISTS canvas_user_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    canvas_sub TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS canvas_user_tokens_updated_at ON canvas_user_tokens;
CREATE TRIGGER canvas_user_tokens_updated_at
  BEFORE UPDATE ON canvas_user_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================
-- 13. ROW LEVEL SECURITY (RLS) PARA AISLAMIENTO MULTI-TENANT
-- ==============================
ALTER TABLE Historial_Feedback_Generado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aislar_tenant_feedback ON Historial_Feedback_Generado;
CREATE POLICY aislar_tenant_feedback ON Historial_Feedback_Generado
    USING (profesor_id = current_setting('app.current_tenant', true) OR estudiante_id = current_setting('app.current_tenant', true));

ALTER TABLE configuracion_asignacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aislar_tenant_configuracion ON configuracion_asignacion;
CREATE POLICY aislar_tenant_configuracion ON configuracion_asignacion
    USING (profesor_id = current_setting('app.current_tenant', true));

ALTER TABLE canvas_user_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aislar_tenant_tokens ON canvas_user_tokens;
CREATE POLICY aislar_tenant_tokens ON canvas_user_tokens
    USING (canvas_sub = current_setting('app.current_tenant', true));

CREATE TABLE IF NOT EXISTS plugin_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    jwt_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_sessions_token ON plugin_sessions(jwt_token);

-- ==============================
-- 14. SEED DATA (PLANTILLAS GLOBALES POR DEFECTO)
-- ==============================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Plantilla_Feedback WHERE profesor_id IS NULL) THEN
        INSERT INTO Plantilla_Feedback (nombre, contenido, profesor_id) VALUES 
        ('Clase Estándar', '{"alto":"Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}.\n\nLo has hecho muy bien, excelente trabajo.\n\nSaludos cordiales,\nProfesor","medio":"Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}.\n\nHas hecho un trabajo más o menos adecuado, pero hay aspectos que puedes mejorar.\n\nSaludos cordiales,\nProfesor","bajo":"Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}.\n\nPor favor, es necesario que le pongas mayor esfuerzo. Consulta el material para mejorar.\n\nSaludos cordiales,\nProfesor"}', NULL),
        ('Feedback Detallado', '{"alto":"Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. Has demostrado un dominio sobresaliente de los conceptos, con una base muy sólida que demuestra un gran nivel de comprensión y dedicación.\n\n¡Sigue así, excelente desempeño!\n\nSaludos,\nProfesor","medio":"Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. Tienes una buena base, pero existen áreas específicas que debemos reforzar para alcanzar un dominio completo de los temas tratados en esta evaluación.\n\nTe animo a revisar el material de estudio.\n\nSaludos,\nProfesor","bajo":"Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. Es fundamental que repasemos el contenido visto en clase, ya que se evidencian conceptos clave que aún no están afianzados.\n\nPor favor, contáctame para aclarar dudas o asiste a las horas de tutoría.\n\nSaludos,\nProfesor"}', NULL),
        ('Evaluación Cruzada', '{"alto":"Hola {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. Tus compañeros y yo coincidimos en que tu trabajo es destacado y aporta gran valor a la revisión entre pares.\n\n¡Felicidades!\n\nSaludos,\nProfesor","medio":"Hola {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. Según la evaluación cruzada, tu desempeño es promedio, presentando un trabajo adecuado pero con oportunidades de mejora identificadas por tus pares.\n\n¡Sigue trabajando!\n\nSaludos,\nProfesor","bajo":"Hola {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. La revisión cruzada indica que hay debilidades importantes en tu entrega que deben ser atendidas, según el consenso de la coevaluación.\n\nRevisa los comentarios de tus compañeros.\n\nSaludos,\nProfesor"}', NULL);
    END IF;
END $$;

-- ==============================
-- 15. CONTROL DE MIGRACIONES Y DESPLIEGUES
-- ==============================
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS migration_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  logs TEXT,
  ejecutado_en TIMESTAMPTZ DEFAULT NOW()
);

