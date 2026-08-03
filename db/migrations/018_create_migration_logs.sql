-- 018_create_migration_logs.sql
-- Tabla para métricas y logs de auditoría de los despliegues de base de datos.

CREATE TABLE IF NOT EXISTS migration_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    version VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    logs TEXT,
    ejecutado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_logs_version ON migration_logs(version);
CREATE INDEX IF NOT EXISTS idx_migration_logs_status ON migration_logs(status);
