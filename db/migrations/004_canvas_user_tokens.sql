-- Migración: Tabla para almacenar tokens de Canvas API (OAuth2) de los usuarios
CREATE TABLE IF NOT EXISTS canvas_user_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    canvas_sub TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER canvas_user_tokens_updated_at
  BEFORE UPDATE ON canvas_user_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_canvas_user_tokens_sub ON canvas_user_tokens(canvas_sub);
