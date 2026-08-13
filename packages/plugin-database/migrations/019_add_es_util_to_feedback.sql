-- db/migrations/019_add_es_util_to_feedback.sql
ALTER TABLE historial_feedback_generado ADD COLUMN IF NOT EXISTS es_util BOOLEAN DEFAULT NULL;
