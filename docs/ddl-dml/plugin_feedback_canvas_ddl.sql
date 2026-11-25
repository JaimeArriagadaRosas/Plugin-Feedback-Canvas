-- ============================================================================
-- DDL Script: Plugin-Feedback-Canvas (PostgreSQL)
-- Consolidated from packages/plugin-database/migrations/ (001 through 025)
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Trigger Functions
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_modificacion = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Custom ENUM Types
DO $$ BEGIN
  CREATE TYPE feedback_estado AS ENUM ('PENDIENTE', 'EDITADO', 'APROBADO', 'ENVIADO', 'RECHAZADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE usuario_rol AS ENUM ('admin', 'teacher', 'student');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Core Tables (Final Post-Migration 025 State)

-- Feedback Templates (001, 005, 011, 013, 016)
CREATE TABLE IF NOT EXISTS plantilla_feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL,
    contenido TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    profesor_id VARCHAR(50),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_plantilla_nombre_profesor UNIQUE (nombre, profesor_id)
);

DROP TRIGGER IF EXISTS plantilla_feedback_updated_at ON plantilla_feedback;
CREATE TRIGGER plantilla_feedback_updated_at
  BEFORE UPDATE ON plantilla_feedback
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Professor Seeding Metadata (013)
CREATE TABLE IF NOT EXISTS profesor_metadata (
    profesor_id VARCHAR(50) PRIMARY KEY,
    has_seeded_templates BOOLEAN DEFAULT FALSE,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Feedback History (001, 006, 016, 017, 019, 025)
CREATE TABLE IF NOT EXISTS historial_feedback_generado (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    tarea_id VARCHAR(50) NOT NULL,
    plantilla_id BIGINT REFERENCES plantilla_feedback(id),
    profesor_id TEXT,
    nombre_curso VARCHAR(255),
    nombre_tarea VARCHAR(255),
    nombre_estudiante VARCHAR(255),
    contenido_generado TEXT NOT NULL,
    prompt_usado TEXT,
    nota_canvas INTEGER,
    nota_chile NUMERIC(3,1),
    aprobado BOOLEAN,
    estado feedback_estado DEFAULT 'PENDIENTE',
    calificacion_profesor INTEGER,
    calificacion_estudiante INTEGER,
    nota_privada TEXT,
    es_util BOOLEAN DEFAULT NULL,
    fecha_generacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_estudiante ON historial_feedback_generado(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_historial_curso ON historial_feedback_generado(curso_id);
CREATE INDEX IF NOT EXISTS idx_historial_plantilla_id ON historial_feedback_generado(plantilla_id);

-- Course & Assignment Configurations (001, 016)
CREATE TABLE IF NOT EXISTS configuracion_curso_tarea (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contexto_tipo VARCHAR(20) NOT NULL,
    contexto_id VARCHAR(50) NOT NULL,
    config_json JSONB NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contexto_tipo, contexto_id)
);

DROP TRIGGER IF EXISTS config_curso_tarea_updated_at ON configuracion_curso_tarea;
CREATE TRIGGER config_curso_tarea_updated_at
  BEFORE UPDATE ON configuracion_curso_tarea
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AI API Keys (001, 015, 016)
CREATE TABLE IF NOT EXISTS llaves_api_ia (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    servicio VARCHAR(50) NOT NULL UNIQUE,
    api_key_encriptada TEXT NOT NULL,
    endpoint_personalizado TEXT,
    activo BOOLEAN DEFAULT TRUE,
    ultima_verificacion TIMESTAMPTZ
);

-- Local Academic History (001, 016)
CREATE TABLE IF NOT EXISTS historial_academico_local (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    resumen_desempeno JSONB,
    ultimo_sync TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(estudiante_id, curso_id)
);

-- Audit Logs (001, 016)
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalle TEXT,
    ip_address VARCHAR(45),
    fecha TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_fecha ON logs_auditoria(fecha);

-- Feedback Notifications (001, 016)
CREATE TABLE IF NOT EXISTS notificaciones_feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    feedback_id BIGINT NOT NULL REFERENCES historial_feedback_generado(id),
    mensaje TEXT NOT NULL,
    metodo VARCHAR(20) DEFAULT 'email',
    enviado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_feedback ON notificaciones_feedback(feedback_id);

-- System Error Notifications (020)
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

-- Student Notification Preferences (024)
CREATE TABLE IF NOT EXISTS Preferencias_Notificacion_Estudiante (
    estudiante_id VARCHAR(255) PRIMARY KEY,
    metodo VARCHAR(50) NOT NULL DEFAULT 'canvas_inapp',
    frecuencia VARCHAR(50) NOT NULL DEFAULT 'siempre',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Global AI Configuration (001, 016, 021, 025)
CREATE TABLE IF NOT EXISTS configuracion_ia (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modelo_preferido VARCHAR(50) DEFAULT 'gemini-1.5-flash',
    proveedor_preferido VARCHAR(50) DEFAULT 'gemini',
    prompt_base TEXT,
    temperatura NUMERIC(3,2) DEFAULT 0.70,
    longitud_maxima INTEGER DEFAULT 2048,
    endpoint_api TEXT,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS config_ia_updated_at ON configuracion_ia;
CREATE TRIGGER config_ia_updated_at
  BEFORE UPDATE ON configuracion_ia
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Per-Assignment Configuration (001, 012)
CREATE TABLE IF NOT EXISTS configuracion_asignacion (
    id_configuracion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    canvas_course_id VARCHAR(50) NOT NULL,
    canvas_assignment_id VARCHAR(50) NOT NULL,
    feedback_activo BOOLEAN DEFAULT FALSE,
    plantilla_id BIGINT REFERENCES plantilla_feedback(id),
    profesor_id VARCHAR(50),
    fecha_modificacion TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(canvas_course_id, canvas_assignment_id)
);

DROP TRIGGER IF EXISTS config_asignacion_updated_at ON configuracion_asignacion;
DROP TRIGGER IF EXISTS config_asignacion_fecha_modificacion ON configuracion_asignacion;
CREATE TRIGGER config_asignacion_fecha_modificacion
  BEFORE UPDATE ON configuracion_asignacion
  FOR EACH ROW EXECUTE FUNCTION set_fecha_modificacion();

-- Per-Assignment Variables (001)
CREATE TABLE IF NOT EXISTS variables_asignacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    configuracion_id BIGINT NOT NULL REFERENCES configuracion_asignacion(id_configuracion),
    variable_id VARCHAR(50) NOT NULL,
    variable_activa BOOLEAN DEFAULT FALSE,
    ponderacion NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_variables_asignacion_config ON variables_asignacion(configuracion_id);

-- Local Users (001)
CREATE TABLE IF NOT EXISTS usuarios_local (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    rol usuario_rol NOT NULL,
    estudiante_index INTEGER NULL,
    canvas_user_id TEXT NOT NULL,
    canvas_user_uuid TEXT NULL,
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

-- LTI User Mappings (001, 007)
CREATE TABLE IF NOT EXISTS user_lti_mappings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    local_user_id BIGINT NOT NULL REFERENCES usuarios_local(id),
    canvas_sub TEXT NOT NULL,
    canvas_uuid TEXT NULL,
    deployment_id TEXT NOT NULL,
    issuer TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(local_user_id, deployment_id, issuer)
);

CREATE INDEX IF NOT EXISTS idx_user_lti_mappings_canvas_sub ON user_lti_mappings(canvas_sub);
CREATE INDEX IF NOT EXISTS idx_user_lti_mappings_deployment ON user_lti_mappings(deployment_id, issuer);

-- Role Permissions (001, 003, 008, 016, 022)
CREATE TABLE IF NOT EXISTS permisos_rol (
    rol usuario_rol PRIMARY KEY,
    permisos JSONB NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS permisos_rol_updated_at ON permisos_rol;
CREATE TRIGGER permisos_rol_updated_at
  BEFORE UPDATE ON permisos_rol
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Canvas OAuth2 User Tokens (001, 004)
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

CREATE INDEX IF NOT EXISTS idx_canvas_user_tokens_sub ON canvas_user_tokens(canvas_sub);

-- LTI 1.3 Nonces (002)
CREATE TABLE IF NOT EXISTS lti_nonces (
    nonce TEXT PRIMARY KEY,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lti_nonces_creado_en ON lti_nonces(creado_en);

-- Plugin Sessions (014)
CREATE TABLE IF NOT EXISTS plugin_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    jwt_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_sessions_token ON plugin_sessions(jwt_token);

-- Webhook Events & Dead Letter Queue (001, 009, 010, 023)
CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_hash VARCHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    last_error TEXT,
    processed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT webhook_events_status_check CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_hash ON webhook_events(event_hash);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);

CREATE TABLE IF NOT EXISTS webhook_dead_letter (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_hash VARCHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    last_error TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_dead_letter_hash ON webhook_dead_letter(event_hash);

-- Migration Audit Logs (018)
CREATE TABLE IF NOT EXISTS migration_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    version VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    logs TEXT,
    ejecutado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_logs_version ON migration_logs(version);
CREATE INDEX IF NOT EXISTS idx_migration_logs_status ON migration_logs(status);

-- 5. Backward-Compatibility Pascal_Case Views (016)
CREATE OR REPLACE VIEW "Plantilla_Feedback" AS SELECT * FROM plantilla_feedback;
CREATE OR REPLACE VIEW "Historial_Feedback_Generado" AS SELECT * FROM historial_feedback_generado;
CREATE OR REPLACE VIEW "Configuracion_Curso_Tarea" AS SELECT * FROM configuracion_curso_tarea;
CREATE OR REPLACE VIEW "Llaves_API_IA" AS SELECT * FROM llaves_api_ia;
CREATE OR REPLACE VIEW "Historial_Academico_Local" AS SELECT * FROM historial_academico_local;
CREATE OR REPLACE VIEW "Logs_Auditoria" AS SELECT * FROM logs_auditoria;
CREATE OR REPLACE VIEW "Notificaciones_Feedback" AS SELECT * FROM notificaciones_feedback;
CREATE OR REPLACE VIEW "Configuracion_IA" AS SELECT * FROM configuracion_ia;
CREATE OR REPLACE VIEW "Permisos_Rol" AS SELECT * FROM permisos_rol;
