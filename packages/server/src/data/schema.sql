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

CREATE TRIGGER permisos_rol_updated_at
  BEFORE UPDATE ON Permisos_Rol
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================
-- 1. TABLA DE PLANTILLAS DE FEEDBACK
-- ==============================
CREATE TABLE IF NOT EXISTS Plantilla_Feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL,
    contenido TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER plantilla_feedback_updated_at
  BEFORE UPDATE ON Plantilla_Feedback
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================
-- 2. HISTORIAL DE FEEDBACKS GENERADOS
-- ==============================
CREATE TABLE IF NOT EXISTS Historial_Feedback_Generado (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    tarea_id VARCHAR(50) NOT NULL,
    plantilla_id BIGINT REFERENCES Plantilla_Feedback(id),
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

CREATE INDEX idx_historial_estudiante ON Historial_Feedback_Generado(estudiante_id);
CREATE INDEX idx_historial_curso ON Historial_Feedback_Generado(curso_id);
CREATE INDEX idx_historial_plantilla_id ON Historial_Feedback_Generado(plantilla_id);

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

CREATE INDEX idx_logs_usuario ON Logs_Auditoria(usuario_id);
CREATE INDEX idx_logs_fecha ON Logs_Auditoria(fecha);

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

CREATE INDEX idx_notificaciones_feedback ON Notificaciones_Feedback(feedback_id);

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
    plantilla_id BIGINT REFERENCES Plantilla_Feedback(id),
    profesor_id VARCHAR(50),
    fecha_modificacion TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(canvas_course_id, canvas_assignment_id)
);

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

CREATE INDEX idx_variables_asignacion_config ON variables_asignacion(configuracion_id);

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

CREATE INDEX idx_usuarios_local_email ON usuarios_local(email);
CREATE INDEX idx_usuarios_local_rol ON usuarios_local(rol);
CREATE INDEX idx_usuarios_local_canvas_user_id ON usuarios_local(canvas_user_id);

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

CREATE INDEX idx_user_lti_mappings_canvas_sub ON user_lti_mappings(canvas_sub);
CREATE INDEX idx_user_lti_mappings_deployment ON user_lti_mappings(deployment_id, issuer);
