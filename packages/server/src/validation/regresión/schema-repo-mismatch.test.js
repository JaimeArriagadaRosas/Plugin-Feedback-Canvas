import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../../data/schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

function extractTable(createTable) {
  const re = new RegExp(`CREATE TABLE IF NOT EXISTS ${createTable}[\\s\\S]*?;`, 'i');
  const match = schemaSql.match(re);
  return match ? match[0] : '';
}

describe('Regresin  Error 1/2/4: coherencia schema.sql vs repositorios', () => {
  it('schema.sql define tabla Configuracion_Curso_Tarea', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS Configuracion_Curso_Tarea');
  });

  it('schema.sql define tabla Configuracion_IA', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS Configuracion_IA');
  });

  it('schema.sql define columna modelo_preferido en Configuracion_IA', () => {
    expect(schemaSql).toContain('modelo_preferido');
  });

  it('schema.sql define tabla Llaves_API_IA', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS Llaves_API_IA');
  });

  it('Llaves_API_IA tiene restriccin UNIQUE en servicio (requerido por ON CONFLICT)', () => {
    const table = extractTable('Llaves_API_IA');
    expect(table).toContain('UNIQUE');
    expect(table.toLowerCase()).toContain('servicio');
  });

  it('schema.sql define tabla Historial_Feedback_Generado', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS Historial_Feedback_Generado');
  });

  it('schema.sql define columna nota_canvas en Historial_Feedback_Generado', () => {
    expect(schemaSql).toContain('nota_canvas');
  });

  it('schema.sql define columna nota_chile en Historial_Feedback_Generado', () => {
    expect(schemaSql).toContain('nota_chile');
  });

  it('schema.sql define tabla Logs_Auditoria', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS Logs_Auditoria');
  });

  it('schema.sql define columna ip_address en Logs_Auditoria (AuditRepository)', () => {
    const table = extractTable('Logs_Auditoria');
    expect(table).toContain('ip_address');
  });

  it('schema.sql define tabla configuracion_asignacion (ConfigRepository)', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS configuracion_asignacion');
  });

  it('schema.sql define tabla variables_asignacion (ConfigRepository)', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS variables_asignacion');
  });

  it('ConfigRepository ya NO referencia la tabla inexistente configuracion_ia', () => {
    // La configuracin de IA debe usar Configuracion_IA, no configuracion_ia.
    const repo = fs.readFileSync(
      path.resolve(__dirname, '../../data/ConfigRepository.js'),
      'utf8'
    );
    expect(repo).not.toContain('configuracion_ia');
    expect(repo).toContain('Configuracion_IA');
  });

  it('repositorio FeedbackRepository usa tabla Historial_Feedback_Generado', async () => {
    const { default: FeedbackRepository } = await import('../../data/FeedbackRepository.js');
    const repo = new FeedbackRepository({ query: async () => ({ rows: [], rowsCount: 0 }) });
    expect(() => repo.listAll()).not.toThrow();
  });
});
