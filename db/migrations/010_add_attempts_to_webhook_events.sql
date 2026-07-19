-- Migración 010: Agregar columna attempts a webhook_events
-- Permite tracking de reintentos para dead-letter queue.

ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1;
