-- Migración 006: Columnas faltantes en Historial_Feedback_Generado
-- Alinea 001_initial_schema.sql con schema.sql (documento de referencia).

ALTER TABLE Historial_Feedback_Generado
  ADD COLUMN IF NOT EXISTS nota_privada TEXT;

ALTER TABLE Historial_Feedback_Generado
  ADD COLUMN IF NOT EXISTS calificacion_estudiante INTEGER;

ALTER TABLE Historial_Feedback_Generado
  ALTER COLUMN plantilla_id DROP NOT NULL;
