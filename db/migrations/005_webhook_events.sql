-- Migración 005: Tabla de idempotencia de webhooks de Canvas
-- Garantiza exactly-once processing para eventos de webhook.

CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_hash VARCHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_hash ON webhook_events(event_hash);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
