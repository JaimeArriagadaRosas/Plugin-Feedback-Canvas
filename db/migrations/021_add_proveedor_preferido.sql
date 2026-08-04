-- Migración 021: Añadir proveedor preferido explícito
-- Permite distinguir entre distintos proveedores aunque tengan nombres de modelos similares o personalizados

ALTER TABLE Configuracion_IA 
ADD COLUMN IF NOT EXISTS proveedor_preferido VARCHAR(50) DEFAULT 'gemini';
