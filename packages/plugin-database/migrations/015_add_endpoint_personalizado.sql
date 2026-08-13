-- 015_add_endpoint_personalizado.sql
-- Añadir columna endpoint_personalizado a llaves_api_ia para soportar endpoints de "Otros" proveedores

ALTER TABLE Llaves_API_IA ADD COLUMN IF NOT EXISTS endpoint_personalizado TEXT;
