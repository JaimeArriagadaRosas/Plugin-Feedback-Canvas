CREATE TABLE IF NOT EXISTS plugin_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    jwt_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_sessions_token ON plugin_sessions(jwt_token);
