-- Migración inicial: schema completo normalizado
-- Esta migración aplica el esquema base del plugin con estándares PostgreSQL 2024-2025

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Función trigger para updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ENUMs
DO $$ BEGIN
  CREATE TYPE feedback_estado AS ENUM ('PENDIENTE','EDITADO','APROBADO','ENVIADO','RECHAZADO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE usuario_rol AS ENUM ('admin','teacher','student');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Tabla de plantillas
CREATE TABLE IF NOT EXISTS Plantilla_Feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL,
    contenido TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    profesor_id VARCHAR(50),
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER plantilla_feedback_updated_at
  BEFORE UPDATE ON Plantilla_Feedback
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Historial de feedback
CREATE TABLE IF NOT EXISTS Historial_Feedback_Generado (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    tarea_id VARCHAR(50) NOT NULL,
    plantilla_id BIGINT NOT NULL REFERENCES Plantilla_Feedback(id),
    contenido_generado TEXT NOT NULL,
    prompt_usado TEXT,
    nota_canvas INTEGER,
    nota_chile NUMERIC(3,1),
    aprobado BOOLEAN,
    estado feedback_estado DEFAULT 'PENDIENTE',
    calificacion_profesor INTEGER,
    calificacion_estudiante INTEGER,
    fecha_generacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_historial_estudiante ON Historial_Feedback_Generado(estudiante_id);
CREATE INDEX idx_historial_curso ON Historial_Feedback_Generado(curso_id);
CREATE INDEX idx_historial_plantilla_id ON Historial_Feedback_Generado(plantilla_id);

-- Configuraciones por curso y asignación
CREATE TABLE IF NOT EXISTS Configuracion_Curso_Tarea (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contexto_tipo VARCHAR(20) NOT NULL,
    contexto_id VARCHAR(50) NOT NULL,
    config_json JSONB NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contexto_tipo, contexto_id)
);

CREATE TRIGGER config_curso_tarea_updated_at
  BEFORE UPDATE ON Configuracion_Curso_Tarea
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Llaves API IA
CREATE TABLE IF NOT EXISTS Llaves_API_IA (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    servicio VARCHAR(50) NOT NULL UNIQUE,
    api_key_encriptada TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    ultima_verificacion TIMESTAMPTZ
);

-- Historial académico local
CREATE TABLE IF NOT EXISTS Historial_Academico_Local (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    resumen_desempeno JSONB,
    ultimo_sync TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(estudiante_id, curso_id)
);

-- Logs de auditoría
CREATE TABLE IF NOT EXISTS Logs_Auditoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalle TEXT,
    ip_address VARCHAR(45),
    fecha TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_usuario ON Logs_Auditoria(usuario_id);
CREATE INDEX idx_logs_fecha ON Logs_Auditoria(fecha);

-- Notificaciones
CREATE TABLE IF NOT EXISTS Notificaciones_Feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    feedback_id BIGINT NOT NULL REFERENCES Historial_Feedback_Generado(id),
    mensaje TEXT NOT NULL,
    metodo VARCHAR(20) DEFAULT 'email',
    enviado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notificaciones_feedback ON Notificaciones_Feedback(feedback_id);

-- Configuración IA
CREATE TABLE IF NOT EXISTS Configuracion_IA (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modelo_preferido VARCHAR(50) DEFAULT 'gemini-1.5-flash',
    prompt_base TEXT,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER config_ia_updated_at
  BEFORE UPDATE ON Configuracion_IA
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Configuración por asignación
CREATE TABLE IF NOT EXISTS configuracion_asignacion (
    id_configuracion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    canvas_course_id VARCHAR(50) NOT NULL,
    canvas_assignment_id VARCHAR(50) NOT NULL,
    feedback_activo BOOLEAN DEFAULT FALSE,
    plantilla_id BIGINT REFERENCES Plantilla_Feedback(id),
    profesor_id VARCHAR(50),
    fecha_modificacion TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(canvas_course_id, canvas_assignment_id)
);

CREATE TRIGGER config_asignacion_updated_at
  BEFORE UPDATE ON configuracion_asignacion
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Variables por asignación
CREATE TABLE IF NOT EXISTS variables_asignacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    configuracion_id BIGINT NOT NULL REFERENCES configuracion_asignacion(id_configuracion),
    variable_id VARCHAR(50) NOT NULL,
    variable_activa BOOLEAN DEFAULT FALSE,
    ponderacion NUMERIC
);

CREATE INDEX idx_variables_asignacion_config ON variables_asignacion(configuracion_id);

-- Tabla de usuarios locales (modo desarrollo)
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

CREATE INDEX idx_usuarios_local_email ON usuarios_local(email);
CREATE INDEX idx_usuarios_local_rol ON usuarios_local(rol);
CREATE INDEX idx_usuarios_local_canvas_user_id ON usuarios_local(canvas_user_id);

CREATE TRIGGER usuarios_local_updated_at
  BEFORE UPDATE ON usuarios_local
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Mapeo LTI para continuidad
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

CREATE INDEX idx_user_lti_mappings_canvas_sub ON user_lti_mappings(canvas_sub);
CREATE INDEX idx_user_lti_mappings_deployment ON user_lti_mappings(deployment_id, issuer);

-- Tabla de permisos por rol (RF52)
CREATE TABLE IF NOT EXISTS Permisos_Rol (
    rol usuario_rol PRIMARY KEY,
    permisos JSONB NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER permisos_rol_updated_at
  BEFORE UPDATE ON Permisos_Rol
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO Permisos_Rol (rol, permisos) VALUES
('teacher', '{"ver_feedback": true, "editar_feedback": true, "enviar_feedback": true, "configurar_llm": false}'),
('admin', '{"ver_feedback": true, "editar_feedback": true, "enviar_feedback": true, "configurar_llm": true}'),
('student', '{"ver_feedback": true, "editar_feedback": false, "enviar_feedback": false, "configurar_llm": false}')
ON CONFLICT (rol) DO NOTHING;

-- Canvas user tokens (OAuth2)
CREATE TABLE IF NOT EXISTS canvas_user_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    canvas_sub TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER canvas_user_tokens_updated_at
  BEFORE UPDATE ON canvas_user_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Webhook events (idempotencia)
CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_hash VARCHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    attempts INTEGER DEFAULT 1,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_hash ON webhook_events(event_hash);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);

-- Dead letter para webhooks fallidos
CREATE TABLE IF NOT EXISTS webhook_dead_letter (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_hash VARCHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB,
    last_error TEXT,
    attempts INTEGER,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);
