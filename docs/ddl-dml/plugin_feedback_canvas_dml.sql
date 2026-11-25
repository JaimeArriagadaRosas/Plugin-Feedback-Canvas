-- ============================================================================
-- DML Script: Plugin-Feedback-Canvas (PostgreSQL)
-- Seeds, migrations, and repository CRUD operations matching the actual schema
-- ============================================================================

BEGIN;

-- 1. Seed & Normalize Role Permissions (Migrations 001, 003, 022)
INSERT INTO permisos_rol (rol, permisos) VALUES
    ('teacher'::usuario_rol, '{"view_feedback": true, "edit_feedback": true, "submit_feedback": true, "config_llm": false}'::jsonb),
    ('admin'::usuario_rol,   '{"view_feedback": true, "edit_feedback": true, "submit_feedback": true, "config_llm": true}'::jsonb),
    ('student'::usuario_rol, '{"view_feedback": true, "edit_feedback": false, "submit_feedback": false, "config_llm": false}'::jsonb)
ON CONFLICT (rol) DO UPDATE
SET permisos = permisos_rol.permisos || EXCLUDED.permisos,
    actualizado_en = NOW();

-- 2. Seed Local Development Users (usuarios_local)
INSERT INTO usuarios_local (email, nombre, password_hash, rol, estudiante_index, canvas_user_id, activo) VALUES
    ('admin@canvas.local', 'Administrador Local', '$2b$10$examplehashadmin000000000000000000000000000', 'admin'::usuario_rol, NULL, '1001', TRUE),
    ('profesor@canvas.local', 'Profesor Demo', '$2b$10$examplehashteacher0000000000000000000000000', 'teacher'::usuario_rol, NULL, '1002', TRUE),
    ('estudiante@canvas.local', 'Estudiante Demo', '$2b$10$examplehashstudent0000000000000000000000000', 'student'::usuario_rol, 1, '1003', TRUE)
ON CONFLICT (email) DO UPDATE
SET nombre = EXCLUDED.nombre,
    rol = EXCLUDED.rol,
    canvas_user_id = EXCLUDED.canvas_user_id,
    activo = TRUE,
    actualizado_en = NOW();

-- 3. Seed Global AI Configuration (configuracion_ia)
INSERT INTO configuracion_ia (modelo_preferido, proveedor_preferido, prompt_base, temperatura, longitud_maxima)
SELECT 'gemini-2.5-flash', 'gemini', 'Eres un asistente pedagógico que genera retroalimentación constructiva, clara y alineada con la rúbrica.', 0.70, 2048
WHERE NOT EXISTS (SELECT 1 FROM configuracion_ia);

-- 4. Seed Default Feedback Templates & Professor Metadata (plantilla_feedback & profesor_metadata)
INSERT INTO plantilla_feedback (nombre, contenido, activo, profesor_id)
VALUES (
    'Retroalimentación Constructiva General',
    'Hola {{student_name}}, gracias por tu entrega en {{assignment_name}}. Fortalezas: {{strengths}}. Oportunidades de mejora: {{improvements}}.',
    TRUE,
    '1002'
)
ON CONFLICT (nombre, profesor_id) DO UPDATE
SET contenido = EXCLUDED.contenido,
    activo = TRUE,
    deleted_at = NULL,
    actualizado_en = NOW();

INSERT INTO profesor_metadata (profesor_id, has_seeded_templates)
VALUES ('1002', TRUE)
ON CONFLICT (profesor_id) DO UPDATE
SET has_seeded_templates = TRUE,
    actualizado_en = NOW();

-- 5. Configure Assignment & Variables (configuracion_asignacion & variables_asignacion)
INSERT INTO configuracion_asignacion (canvas_course_id, canvas_assignment_id, feedback_activo, plantilla_id, profesor_id)
SELECT 'course_101', 'assign_202', TRUE, id, '1002'
FROM plantilla_feedback
WHERE nombre = 'Retroalimentación Constructiva General' AND profesor_id = '1002'
ON CONFLICT (canvas_course_id, canvas_assignment_id) DO UPDATE
SET feedback_activo = TRUE,
    plantilla_id = EXCLUDED.plantilla_id;

INSERT INTO variables_asignacion (configuracion_id, variable_id, variable_activa, ponderacion)
SELECT id_configuracion, 'rubric_criteria', TRUE, 1.0
FROM configuracion_asignacion
WHERE canvas_course_id = 'course_101' AND canvas_assignment_id = 'assign_202'
  AND NOT EXISTS (
      SELECT 1 FROM variables_asignacion va
      WHERE va.configuracion_id = configuracion_asignacion.id_configuracion
        AND va.variable_id = 'rubric_criteria'
  );

-- 6. Feedback Lifecycle DML (historial_feedback_generado)
-- 6a. Insert generated feedback draft
INSERT INTO historial_feedback_generado (
    estudiante_id, curso_id, tarea_id, plantilla_id, profesor_id,
    nombre_curso, nombre_tarea, nombre_estudiante,
    contenido_generado, prompt_usado, nota_canvas, nota_chile, aprobado, estado
)
SELECT
    '1003', 'course_101', 'assign_202', p.id, '1002',
    'Ingeniería de Software', 'Entrega Proyecto 1', 'Estudiante Demo',
    'Buen análisis estructural; profundiza en las conclusiones.',
    'Evalúa la entrega según la rúbrica.',
    85, 6.0, TRUE, 'PENDIENTE'::feedback_estado
FROM plantilla_feedback p
WHERE p.nombre = 'Retroalimentación Constructiva General' AND p.profesor_id = '1002'
LIMIT 1;

-- 6b. Teacher adds private note & approves/sends feedback
UPDATE historial_feedback_generado
SET nota_privada = 'Revisado en sesión de ayudantía.',
    calificacion_profesor = 5,
    estado = 'ENVIADO'::feedback_estado
WHERE curso_id = 'course_101'
  AND tarea_id = 'assign_202'
  AND estudiante_id = '1003'
  AND estado = 'PENDIENTE'::feedback_estado;

-- 6c. Student rates feedback utility (Migrations 006 & 019)
UPDATE historial_feedback_generado
SET calificacion_estudiante = 5,
    es_util = TRUE
WHERE curso_id = 'course_101'
  AND tarea_id = 'assign_202'
  AND estudiante_id = '1003';

-- 6d. Query feedback history for dashboard
SELECT
    h.id,
    h.curso_id,
    h.nombre_curso,
    h.tarea_id,
    h.nombre_tarea,
    h.estudiante_id,
    h.nombre_estudiante,
    h.nota_canvas,
    h.nota_chile,
    h.estado,
    h.es_util,
    p.nombre AS plantilla_nombre
FROM historial_feedback_generado h
LEFT JOIN plantilla_feedback p ON p.id = h.plantilla_id
WHERE h.curso_id = 'course_101'
ORDER BY h.fecha_generacion DESC;

-- 7. Student Notification Preferences & Audit Log (Preferencias_Notificacion_Estudiante & logs_auditoria)
INSERT INTO Preferencias_Notificacion_Estudiante (estudiante_id, metodo, frecuencia)
VALUES ('1003', 'canvas_inapp', 'siempre')
ON CONFLICT (estudiante_id) DO UPDATE
SET metodo = EXCLUDED.metodo,
    frecuencia = EXCLUDED.frecuencia,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO logs_auditoria (usuario_id, accion, detalle, ip_address)
VALUES ('1002', 'FEEDBACK_ENVIADO', 'Feedback enviado para estudiante 1003 en tarea assign_202', '127.0.0.1');

COMMIT;
