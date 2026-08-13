-- 017_add_profesor_id_to_feedback.sql
-- Añade la columna profesor_id al historial de feedback y las otras faltantes que pudieran haber quedado fuera.

ALTER TABLE historial_feedback_generado ADD COLUMN IF NOT EXISTS profesor_id TEXT;
ALTER TABLE historial_feedback_generado ADD COLUMN IF NOT EXISTS nombre_curso VARCHAR(255);
ALTER TABLE historial_feedback_generado ADD COLUMN IF NOT EXISTS nombre_tarea VARCHAR(255);
ALTER TABLE historial_feedback_generado ADD COLUMN IF NOT EXISTS nombre_estudiante VARCHAR(255);
