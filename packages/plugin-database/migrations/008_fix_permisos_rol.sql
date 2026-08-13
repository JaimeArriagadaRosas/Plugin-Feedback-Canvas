-- Migración 008: Unificar Permisos_Rol con schema.sql
-- 003_role_permissions.sql usaba id BIGINT y rol VARCHAR(50).
-- schema.sql define rol como PRIMARY KEY directo del ENUM usuario_rol.
-- Esta migración elimina la columna id sobrante y alinea la estructura.

-- Paso 1: Renombrar tabla actual como respaldo
ALTER TABLE IF EXISTS Permisos_Rol RENAME TO Permisos_Rol_legacy;

-- Paso 2: Crear tabla con el esquema de schema.sql
CREATE TABLE IF NOT EXISTS Permisos_Rol (
    rol usuario_rol PRIMARY KEY,
    permisos JSONB NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS permisos_rol_updated_at ON Permisos_Rol;
CREATE TRIGGER permisos_rol_updated_at
  BEFORE UPDATE ON Permisos_Rol
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Paso 3: Migrar datos legacy (si existían)
INSERT INTO Permisos_Rol (rol, permisos, actualizado_en)
SELECT rol::usuario_rol, permisos, actualizado_en
FROM Permisos_Rol_legacy
ON CONFLICT (rol) DO NOTHING;

-- Paso 4: Eliminar tabla legacy
DROP TABLE IF EXISTS Permisos_Rol_legacy;
