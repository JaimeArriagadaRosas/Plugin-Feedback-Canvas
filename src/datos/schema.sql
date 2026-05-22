-- Esquema de Base de Datos para el Plugin de Feedback (PostgreSQL)

-- 1. Tabla de Plantillas de Feedback
CREATE TABLE IF NOT EXISTS plantillas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    contenido TEXT NOT NULL, -- Soporta placeholders como {{STUDENT_NAME}}
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Historial de Feedbacks Generados
CREATE TABLE IF NOT EXISTS historial_feedbacks (
    id SERIAL PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    tarea_id VARCHAR(50) NOT NULL,
    plantilla_id INTEGER REFERENCES plantillas(id),
    contenido_generado TEXT NOT NULL,
    prompt_usado TEXT,
    nota_canvas INTEGER,          -- Puntaje Canvas (0–100)
    nota_chile NUMERIC(3,1),      -- Nota escala chilena (1.0–7.0)
    aprobado BOOLEAN,             -- true si nota_chile >= 4.0
    estado VARCHAR(20) DEFAULT 'generado', -- generado, enviado, error
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Configuraciones por Curso y Asignación
CREATE TABLE IF NOT EXISTS configuraciones (
    id SERIAL PRIMARY KEY,
    contexto_tipo VARCHAR(20) NOT NULL, -- 'curso' o 'tarea'
    contexto_id VARCHAR(50) NOT NULL,
    config_json JSONB NOT NULL, -- Configuración flexible (IA activa, tonos, etc.)
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contexto_tipo, contexto_id)
);

-- 4. Tokens y Llaves de API de Servicios IA
CREATE TABLE IF NOT EXISTS tokens_ia (
    id SERIAL PRIMARY KEY,
    servicio VARCHAR(50) NOT NULL, -- 'gemini', 'openai', etc.
    api_key_encriptada TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    ultima_verificacion TIMESTAMP
);

-- 5. Historial Académico de Estudiantes (Cache Local)
CREATE TABLE IF NOT EXISTS historial_academico (
    id SERIAL PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    resumen_desempeno JSONB, -- Calificaciones previas, tendencias
    ultimo_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(estudiante_id, curso_id)
);

-- 6. Logs de Auditoría
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalle TEXT,
    ip_address VARCHAR(45),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_historial_estudiante ON historial_feedbacks(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_historial_curso ON historial_feedbacks(curso_id);
