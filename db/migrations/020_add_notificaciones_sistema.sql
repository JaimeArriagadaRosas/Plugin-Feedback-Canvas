CREATE TABLE IF NOT EXISTS notificaciones_sistema (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profesor_id VARCHAR(50) NOT NULL,
    tipo_error VARCHAR(50) NOT NULL,
    mensaje_error TEXT,
    detalle TEXT,
    contexto JSONB,
    leido BOOLEAN DEFAULT FALSE,
    resuelto BOOLEAN DEFAULT FALSE,
    fecha TIMESTAMPTZ DEFAULT NOW(),
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_sistema_profesor ON notificaciones_sistema(profesor_id);
CREATE INDEX IF NOT EXISTS idx_notif_sistema_tipo ON notificaciones_sistema(tipo_error);
CREATE INDEX IF NOT EXISTS idx_notif_sistema_leido ON notificaciones_sistema(leido);
