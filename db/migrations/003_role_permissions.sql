-- Migración 003: Permisos Dinámicos por Rol (RF52)

CREATE TABLE IF NOT EXISTS Permisos_Rol (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol VARCHAR(50) NOT NULL UNIQUE,
    permisos JSONB NOT NULL DEFAULT '{"ver_feedback": true, "editar_feedback": false, "enviar_feedback": false, "configurar_llm": false}',
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Permisos por defecto
INSERT INTO Permisos_Rol (rol, permisos) VALUES 
('teacher', '{"ver_feedback": true, "editar_feedback": true, "enviar_feedback": true, "configurar_llm": false}'),
('admin', '{"ver_feedback": true, "editar_feedback": true, "enviar_feedback": true, "configurar_llm": true}'),
('student', '{"ver_feedback": true, "editar_feedback": false, "enviar_feedback": false, "configurar_llm": false}')
ON CONFLICT (rol) DO NOTHING;

CREATE TRIGGER permisos_rol_updated_at
  BEFORE UPDATE ON Permisos_Rol
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
