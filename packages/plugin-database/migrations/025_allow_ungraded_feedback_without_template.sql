-- Qualitative feedback does not require a grade-linked template.
ALTER TABLE historial_feedback_generado ALTER COLUMN plantilla_id DROP NOT NULL;
