import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { assessMigrationHistory, inspectMigrationCompatibility } from '../../../../packages/plugin-database/src/migrations/CompatibilityPreflight.js';
import { runMigrations } from '../../../../packages/plugin-database/src/migrations/MigrationRunner.js';

const known = ['001_initial', '002_second', '003_third'];

describe('Compatibilidad de historial PostgreSQL del plugin', () => {
  it('acepta base limpia, prefijo antiguo y una base actual', () => {
    expect(assessMigrationHistory(known, []).status).toBe('clean');
    expect(assessMigrationHistory(known, ['001_initial']).status).toBe('compatible-legacy');
    expect(assessMigrationHistory(known, known).status).toBe('up-to-date');
  });

  it('bloquea migraciones futuras desconocidas y huecos entre versiones', () => {
    expect(assessMigrationHistory(known, ['001_initial', '999_future']).code).toBe('PLUGIN-DB-HISTORY-001');
    expect(assessMigrationHistory(known, ['001_initial', '003_third']).code).toBe('PLUGIN-DB-HISTORY-002');
    expect(assessMigrationHistory(known, ['001_initial', '001_initial']).code).toBe('PLUGIN-DB-HISTORY-003');
  });

  it('consulta el historial dentro de una transacción de solo lectura', async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-plugin-migration-'));
    try {
      for (const version of known) fs.writeFileSync(path.join(folder, version + '.sql'), 'SELECT 1;');
      const calls = [];
      const client = {
        query: vi.fn(async sql => {
          calls.push(sql);
          if (sql.includes('to_regclass')) return { rows: [{ migration_table: 'schema_migrations' }] };
          if (sql.includes('SELECT version')) return { rows: [{ version: '001_initial' }] };
          return { rows: [] };
        })
      };
      const diagnosis = await inspectMigrationCompatibility(client, folder);
      expect(diagnosis).toMatchObject({ status: 'compatible-legacy', appliedCount: 1, pendingCount: 2 });
      expect(calls).toEqual([
        'BEGIN TRANSACTION READ ONLY',
        "SELECT to_regclass('public.schema_migrations') AS migration_table",
        'SELECT version FROM public.schema_migrations ORDER BY version',
        'ROLLBACK'
      ]);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  it('bloquea tablas heredadas sin historial sin modificar su esquema', async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-unknown-history-'));
    try {
      fs.writeFileSync(path.join(folder, '001_initial.sql'), 'SELECT 1;');
      const calls = [];
      const client = { query: vi.fn(async statement => {
        calls.push(statement);
        if (statement.includes('to_regclass')) return { rows: [{ migration_table: null }] };
        if (statement.includes('has_user_tables')) return { rows: [{ has_user_tables: true }] };
        return { rows: [] };
      }) };
      const diagnosis = await inspectMigrationCompatibility(client, folder);
      expect(diagnosis).toMatchObject({ status: 'blocked', code: 'PLUGIN-DB-HISTORY-004' });
      expect(calls).toContain('BEGIN TRANSACTION READ ONLY');
      expect(calls).toContain('ROLLBACK');
      expect(calls.every(sql => !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i.test(sql))).toBe(true);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  it('evita escritura o CREATE TABLE si una base tiene versión desconocida', async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-block-migration-'));
    try {
      fs.writeFileSync(path.join(folder, '001_initial.sql'), 'SELECT 1;');
      const calls = [];
      const client = {
        query: vi.fn(async (sql) => {
          calls.push(sql);
          if (sql.includes('to_regclass')) return { rows: [{ migration_table: 'schema_migrations' }] };
          if (sql.includes('SELECT version')) return { rows: [{ version: '999_external' }] };
          return { rows: [] };
        })
      };
      await expect(runMigrations({
        client, migrationsDirectory: folder, requireSafeHistory: true,
        reporter: {}
      })).rejects.toThrow('PLUGIN-DB-HISTORY-001');
      expect(calls.some(sql => /CREATE TABLE|INSERT INTO|ALTER TABLE/i.test(sql))).toBe(false);
      expect(calls).toContain('ROLLBACK');
      expect(calls.some(sql => sql.includes('pg_advisory_unlock'))).toBe(true);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});
