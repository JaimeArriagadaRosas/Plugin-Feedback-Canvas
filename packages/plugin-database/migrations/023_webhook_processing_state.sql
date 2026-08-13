-- Separa recepción, procesamiento, fallo y dead-letter para que un fallo pueda
-- reintentarse sin tratarse como un evento ya procesado.

ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE webhook_events
  ALTER COLUMN processed_at DROP DEFAULT;

-- Antes de esta migración processed_at se establecía al insertar. Para evitar
-- reejecutar eventos históricos, se consideran procesados los ya existentes.
UPDATE webhook_events
SET status = 'PROCESSED', updated_at = NOW()
WHERE processed_at IS NOT NULL AND status = 'PENDING';

DO $$ BEGIN
  ALTER TABLE webhook_events
    ADD CONSTRAINT webhook_events_status_check
    CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
