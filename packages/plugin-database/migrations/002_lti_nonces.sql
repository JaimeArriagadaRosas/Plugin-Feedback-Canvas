-- Migración 002: Tabla para prevención de ataques de repetición (Replay Attacks) LTI 1.3
-- Guarda el nonce consumido con un timestamp para poder limpiar los expirados.

CREATE TABLE IF NOT EXISTS lti_nonces (
  nonce TEXT PRIMARY KEY,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Indice para limpieza de nonces antiguos (ej. mayores a 1 hora)
CREATE INDEX IF NOT EXISTS idx_lti_nonces_creado_en ON lti_nonces(creado_en);
