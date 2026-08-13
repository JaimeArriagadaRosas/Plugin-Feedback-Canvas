-- Agregar tabla de metadatos del profesor para rastrear el sembrado
CREATE TABLE IF NOT EXISTS Profesor_Metadata (
    profesor_id VARCHAR(50) PRIMARY KEY,
    has_seeded_templates BOOLEAN DEFAULT FALSE,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columna para soft deletes en la tabla de plantillas
ALTER TABLE Plantilla_Feedback ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
