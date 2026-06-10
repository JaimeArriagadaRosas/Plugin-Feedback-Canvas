-- Esquema de Base de Datos para el Plugin de Feedback (PostgreSQL)

-- 1. Tabla de Plantillas de Feedback
CREATE TABLE IF NOT EXISTS Plantilla_Feedback (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    contenido TEXT NOT NULL, -- Soporta placeholders como {{STUDENT_NAME}}
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Historial de Feedbacks Generados
CREATE TABLE IF NOT EXISTS Historial_Feedback_Generado (
    id SERIAL PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    tarea_id VARCHAR(50) NOT NULL,
    plantilla_id INTEGER REFERENCES Plantilla_Feedback(id),
    contenido_generado TEXT NOT NULL,
    prompt_usado TEXT,
    nota_canvas INTEGER,          -- Puntaje Canvas (0–100)
    nota_chile NUMERIC(3,1),      -- Nota escala chilena (1.0–7.0)
    aprobado BOOLEAN,             -- true si nota_chile >= 4.0
    estado VARCHAR(20) DEFAULT 'generado', -- generado, enviado, error
    calificacion_profesor INTEGER, -- 1 a 5 estrellas
    calificacion_estudiante INTEGER, -- 1 a 5 estrellas
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Configuraciones por Curso y Asignación
CREATE TABLE IF NOT EXISTS Configuracion_Curso_Tarea (
    id SERIAL PRIMARY KEY,
    contexto_tipo VARCHAR(20) NOT NULL, -- 'curso' o 'tarea'
    contexto_id VARCHAR(50) NOT NULL,
    config_json JSONB NOT NULL, -- Configuración flexible (IA activa, tonos, etc.)
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contexto_tipo, contexto_id)
);

-- 4. Tokens y Llaves de API de Servicios IA
CREATE TABLE IF NOT EXISTS Llaves_API_IA (
    id SERIAL PRIMARY KEY,
    servicio VARCHAR(50) NOT NULL, -- 'gemini', 'openai', etc.
    api_key_encriptada TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    ultima_verificacion TIMESTAMP
);

-- 5. Historial Académico de Estudiantes (Cache Local)
CREATE TABLE IF NOT EXISTS Historial_Academico_Local (
    id SERIAL PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    curso_id VARCHAR(50) NOT NULL,
    resumen_desempeno JSONB, -- Calificaciones previas, tendencias
    ultimo_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(estudiante_id, curso_id)
);

-- 6. Logs de Auditoría
CREATE TABLE IF NOT EXISTS Logs_Auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalle TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Historial de Notificaciones
CREATE TABLE IF NOT EXISTS Notificaciones_Feedback (
    id SERIAL PRIMARY KEY,
    estudiante_id VARCHAR(50) NOT NULL,
    feedback_id INTEGER REFERENCES Historial_Feedback_Generado(id),
    mensaje TEXT NOT NULL,
    metodo VARCHAR(20) DEFAULT 'email', -- email, push
    enviado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_historial_estudiante ON Historial_Feedback_Generado(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_historial_curso ON Historial_Feedback_Generado(curso_id);
