-- 016_rename_tables_snake_case.sql
-- Renombrar tablas Pascal_Case a snake_case y crear vistas de compatibilidad

DO $$ BEGIN

    -- Plantilla_Feedback
    ALTER TABLE IF EXISTS "Plantilla_Feedback" RENAME TO plantilla_feedback;
    CREATE OR REPLACE VIEW "Plantilla_Feedback" AS SELECT * FROM plantilla_feedback;

    -- Historial_Feedback_Generado
    ALTER TABLE IF EXISTS "Historial_Feedback_Generado" RENAME TO historial_feedback_generado;
    CREATE OR REPLACE VIEW "Historial_Feedback_Generado" AS SELECT * FROM historial_feedback_generado;

    -- Configuracion_Curso_Tarea
    ALTER TABLE IF EXISTS "Configuracion_Curso_Tarea" RENAME TO configuracion_curso_tarea;
    CREATE OR REPLACE VIEW "Configuracion_Curso_Tarea" AS SELECT * FROM configuracion_curso_tarea;

    -- Llaves_API_IA
    ALTER TABLE IF EXISTS "Llaves_API_IA" RENAME TO llaves_api_ia;
    CREATE OR REPLACE VIEW "Llaves_API_IA" AS SELECT * FROM llaves_api_ia;

    -- Historial_Academico_Local
    ALTER TABLE IF EXISTS "Historial_Academico_Local" RENAME TO historial_academico_local;
    CREATE OR REPLACE VIEW "Historial_Academico_Local" AS SELECT * FROM historial_academico_local;

    -- Logs_Auditoria
    ALTER TABLE IF EXISTS "Logs_Auditoria" RENAME TO logs_auditoria;
    CREATE OR REPLACE VIEW "Logs_Auditoria" AS SELECT * FROM logs_auditoria;

    -- Notificaciones_Feedback
    ALTER TABLE IF EXISTS "Notificaciones_Feedback" RENAME TO notificaciones_feedback;
    CREATE OR REPLACE VIEW "Notificaciones_Feedback" AS SELECT * FROM notificaciones_feedback;

    -- Configuracion_IA
    ALTER TABLE IF EXISTS "Configuracion_IA" RENAME TO configuracion_ia;
    CREATE OR REPLACE VIEW "Configuracion_IA" AS SELECT * FROM configuracion_ia;

    -- Permisos_Rol
    ALTER TABLE IF EXISTS "Permisos_Rol" RENAME TO permisos_rol;
    CREATE OR REPLACE VIEW "Permisos_Rol" AS SELECT * FROM permisos_rol;

EXCEPTION WHEN duplicate_table THEN
    -- Ignorar si la vista o tabla ya existe
    NULL;
END $$;
