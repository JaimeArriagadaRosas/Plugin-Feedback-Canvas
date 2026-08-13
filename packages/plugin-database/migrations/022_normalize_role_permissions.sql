-- Normaliza las claves históricas en español al contrato vigente en inglés.
-- El estudiante debe poder ver feedback por defecto (RF de permisos).

UPDATE permisos_rol
SET permisos = (permisos - 'ver_feedback' - 'editar_feedback' - 'enviar_feedback' - 'configurar_llm')
  || jsonb_build_object(
    'view_feedback', CASE
      WHEN rol = 'student'::usuario_rol THEN true
      ELSE COALESCE((permisos ->> 'view_feedback')::boolean, (permisos ->> 'ver_feedback')::boolean, false)
    END,
    'edit_feedback', COALESCE((permisos ->> 'edit_feedback')::boolean, (permisos ->> 'editar_feedback')::boolean, false),
    'submit_feedback', COALESCE((permisos ->> 'submit_feedback')::boolean, (permisos ->> 'enviar_feedback')::boolean, false),
    'config_llm', COALESCE((permisos ->> 'config_llm')::boolean, (permisos ->> 'configurar_llm')::boolean, false)
  ),
  actualizado_en = NOW();

INSERT INTO permisos_rol (rol, permisos)
VALUES (
  'student'::usuario_rol,
  '{"view_feedback": true, "edit_feedback": false, "submit_feedback": false, "config_llm": false}'::jsonb
)
ON CONFLICT (rol) DO UPDATE
SET permisos = permisos_rol.permisos || jsonb_build_object('view_feedback', true),
    actualizado_en = NOW();
