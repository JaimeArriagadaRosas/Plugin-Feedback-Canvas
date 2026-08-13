-- Fix trigger for configuracion_asignacion which uses fecha_modificacion instead of actualizado_en

DROP TRIGGER IF EXISTS config_asignacion_updated_at ON configuracion_asignacion;

CREATE OR REPLACE FUNCTION set_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_modificacion = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER config_asignacion_fecha_modificacion
  BEFORE UPDATE ON configuracion_asignacion
  FOR EACH ROW EXECUTE FUNCTION set_fecha_modificacion();
