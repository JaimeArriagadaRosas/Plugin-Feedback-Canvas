-- Add unique constraint for templates by name and professor ID to allow idempotent upserts
DO $$ BEGIN
  ALTER TABLE Plantilla_Feedback
    ADD CONSTRAINT uq_plantilla_nombre_profesor UNIQUE (nombre, profesor_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
