-- Migración para forzar canvas_user_uuid a TEXT
-- Resuelve conflicto con bases de datos heredadas que lo tenían como uuid
ALTER TABLE usuarios_local ALTER COLUMN canvas_user_uuid TYPE TEXT USING canvas_user_uuid::text;
