-- Los feedbacks cualitativos no utilizan plantilla.
ALTER TABLE historial_feedback_generado ALTER COLUMN plantilla_id DROP NOT NULL;
