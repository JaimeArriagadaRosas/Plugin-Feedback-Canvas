-- Migración 007: Tabla user_lti_mappings
-- Alinea 001_initial_schema.sql con schema.sql (documento de referencia).

CREATE TABLE IF NOT EXISTS user_lti_mappings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    local_user_id BIGINT NOT NULL REFERENCES usuarios_local(id),
    canvas_sub TEXT NOT NULL,
    canvas_uuid UUID NULL,
    deployment_id TEXT NOT NULL,
    issuer TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(local_user_id, deployment_id, issuer)
);

CREATE INDEX IF NOT EXISTS idx_user_lti_mappings_canvas_sub ON user_lti_mappings(canvas_sub);
CREATE INDEX IF NOT EXISTS idx_user_lti_mappings_deployment ON user_lti_mappings(deployment_id, issuer);
