/**
 * DEPRECATED: Este runner legacy ya no se usa.
 *
 * Las migraciones activas se encuentran en db/migrations/*.sql y son aplicadas
 * por packages/server/src/data/migrations.js en orden alfabético dentro de
 * transacciones, con tracking en schema_migrations.
 *
 * Este archivo se mantiene solo como referencia histórica. No ejecutarlo en
 * producción porque su ruta de import (../../src/datos/db.js) está rota y su
 * esquema difiere del actual (SERIAL vs BIGINT GENERATED ALWAYS AS IDENTITY,
 * nombres de tablas y columnas inconsistentes).
 */

import db from '../../src/datos/db.js';
import logger from '../../src/utils/logger.js';

async function runMigrations() {
  if (db.isLocalMode && db.isLocalMode()) {
    logger.info('Modo local activo: saltando migraciones de PostgreSQL.');
    process.exit(0);
  }

  const migrations = [
    `CREATE TABLE IF NOT EXISTS Plantilla_Feedback (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      contenido TEXT NOT NULL,
      profesor_id VARCHAR(50),
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS Historial_Feedback_Generado (
      id SERIAL PRIMARY KEY,
      estudiante_id VARCHAR(50) NOT NULL,
      curso_id VARCHAR(50) NOT NULL,
      tarea_id VARCHAR(50) NOT NULL,
      plantilla_feedback_id BIGINT,
      contenido_generado TEXT NOT NULL,
      prompt_usado TEXT,
      nota_canvas INTEGER,
      nota_chile DECIMAL(3,1),
      aprobado BOOLEAN,
      estado VARCHAR(20) DEFAULT 'generado',
      calificacion_profesor INTEGER,
      calificacion_estudiante INTEGER,
      fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_historial_estudiante ON Historial_Feedback_Generado (estudiante_id)`,
    `CREATE INDEX IF NOT EXISTS idx_historial_curso ON Historial_Feedback_Generado (curso_id)`,
    `CREATE TABLE IF NOT EXISTS Configuracion_Curso_Tarea (
      id SERIAL PRIMARY KEY,
      contexto_tipo VARCHAR(20) NOT NULL,
      contexto_id VARCHAR(50) NOT NULL,
      config_json JSONB NOT NULL,
      actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (contexto_tipo, contexto_id)
    )`,
    `CREATE TABLE IF NOT EXISTS Llaves_API_IA (
      id SERIAL PRIMARY KEY,
      servicio VARCHAR(50) NOT NULL,
      api_key_encriptada TEXT NOT NULL,
      activo BOOLEAN DEFAULT TRUE,
      ultima_verificacion TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS Historial_Academico_Local (
      id SERIAL PRIMARY KEY,
      estudiante_id VARCHAR(50) NOT NULL,
      curso_id VARCHAR(50) NOT NULL,
      resumen_desempeno JSONB,
      ultimo_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (estudiante_id, curso_id)
    )`,
    `CREATE TABLE IF NOT EXISTS Logs_Auditoria (
      id SERIAL PRIMARY KEY,
      usuario_id VARCHAR(50) NOT NULL,
      accion VARCHAR(100) NOT NULL,
      detalle TEXT,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS Notificaciones_Feedbacks (
      id SERIAL PRIMARY KEY,
      estudiante_id VARCHAR(50) NOT NULL,
      historial_feedback_generado_id BIGINT,
      mensaje TEXT NOT NULL,
      metodo VARCHAR(20) DEFAULT 'email',
      enviado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS webhook_events (
      id SERIAL PRIMARY KEY,
      event_hash VARCHAR(64) NOT NULL,
      event_type VARCHAR(50),
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (event_hash)
    )`,
    `CREATE TABLE IF NOT EXISTS Configuracion_IA (
      id SERIAL PRIMARY KEY,
      modelo_preferido VARCHAR(64),
      prompt_base TEXT,
      temperatura DECIMAL(3,2),
      longitud_maxima INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS Configuracion_Asignacion (
      id SERIAL PRIMARY KEY,
      canvas_course_id BIGINT,
      canvas_assignment_id BIGINT,
      feedback_activo BOOLEAN DEFAULT TRUE,
      plantilla_id BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS Variables_Asignacion (
      id SERIAL PRIMARY KEY,
      canvas_course_id BIGINT,
      canvas_assignment_id BIGINT,
      variable_id VARCHAR(50) NOT NULL,
      variable_activa BOOLEAN DEFAULT TRUE,
      ponderacion INTEGER DEFAULT 100
    )`
  ];

  logger.info('Ejecutando migraciones de PostgreSQL...');
  try {
    for (const sql of migrations) {
      await db.query(sql);
    }
    logger.info('Migraciones completadas exitosamente.');
    process.exit(0);
  } catch (error) {
    logger.error('Error en migraciones', { error: error.message });
    process.exit(1);
  }
}

runMigrations();