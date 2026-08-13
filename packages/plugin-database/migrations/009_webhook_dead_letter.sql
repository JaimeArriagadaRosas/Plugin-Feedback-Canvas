-- Migración 009: Dead-letter queue para webhooks fallidos
-- Almacena eventos que excedieron los reintentos permitidos para revisión manual.

CREATE TABLE IF NOT EXISTS webhook_dead_letter (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_hash VARCHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    last_error TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_dead_letter_hash ON webhook_dead_letter(event_hash);
