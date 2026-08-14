-- Migración 025: Añadir campos de configuración detallada de IA
-- Añade temperatura, longitud máxima y endpoint api

ALTER TABLE configuracion_ia 
ADD COLUMN IF NOT EXISTS temperatura NUMERIC(3,2) DEFAULT 0.70,
ADD COLUMN IF NOT EXISTS longitud_maxima INTEGER DEFAULT 2048,
ADD COLUMN IF NOT EXISTS endpoint_api TEXT;
