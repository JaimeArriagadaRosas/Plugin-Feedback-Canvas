import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AuditRepository from '../../data/AuditRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaSql = fs.readFileSync(path.resolve(__dirname, '../../data/schema.sql'), 'utf8');

function extractTable(createTable) {
  const re = new RegExp(`CREATE TABLE IF NOT EXISTS ${createTable}[\\s\\S]*?;`, 'i');
  const match = schemaSql.match(re);
  return match ? match[0] : '';
}

describe('Regresin  Error 2/3: columna ip_address en AuditRepository', () => {
  it('schema.sql define la columna ip_address en Logs_Auditoria', () => {
    const table = extractTable('Logs_Auditoria');
    expect(table).toContain('ip_address');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AuditRepository.log inserta sin error en modo local', async () => {
    const { default: db } = await import('../../data/db.js');
    const originalQuery = db.query.bind(db);
    const mockQuery = vi.fn(async (text, params) => {
      if (text.includes('INSERT INTO Logs_Auditoria')) {
        return { rows: [{ id: 1 }], rowCount: 1 };
      }
      return originalQuery(text, params);
    });
    db.query = mockQuery;

    await AuditRepository.log('user-1', 'TEST_ACTION', 'Detalle de prueba', '192.168.1.1');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('AuditRepository.log usa 4 parmetros (usuario_id, accion, detalle, ip_address)', async () => {
    const { default: db } = await import('../../data/db.js');
    const originalQuery = db.query.bind(db);
    let capturedQuery = '';
    let capturedParams = [];

    db.query = async (text, params) => {
      capturedQuery = text;
      capturedParams = params;
      return { rows: [{ id: 1 }], rowCount: 1 };
    };

    await AuditRepository.log('user-1', 'TEST', 'detalle', '10.0.0.1');

    expect(capturedQuery).toContain('INSERT INTO Logs_Auditoria');
    expect(capturedQuery).toContain('ip_address');
    expect(capturedParams.length).toBe(4);
    expect(capturedParams[0]).toBe('user-1');
    expect(capturedParams[1]).toBe('TEST');
    expect(capturedParams[2]).toBe('detalle');
    expect(capturedParams[3]).toBe('10.0.0.1');

    db.query = originalQuery;
  });
});
