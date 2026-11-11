import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { diagnoseCanvasReadOnly } from '../../src/diagnostics/CanvasReadOnlyDiagnosis.js';

const workspaces = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-readonly-'));
  workspaces.push(root);
  const pluginDir = path.join(root, 'plugin');
  const canvasDir = path.join(root, 'canvas');
  fs.mkdirSync(pluginDir);
  fs.mkdirSync(canvasDir);
  fs.writeFileSync(path.join(canvasDir, 'docker-compose.yml'), 'services:\n  postgres: {}\n');
  return { pluginDir, canvasDir };
}
afterEach(() => {
  for (const root of workspaces.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function execution(canvasDir, { stopped = [], wrongProject = false, failedSql = false, error = true, schemaMissing = false, missingMigrationHistory = false, redisUnhealthy = false } = {}) {
  const calls = [];
  const ids = { postgres: 'a'.repeat(64), web: 'b'.repeat(64), redis: 'c'.repeat(64) };
  const execute = vi.fn(async (command, args, options = {}) => {
    calls.push({ command, args, options });
    if (command === 'git') return { stdout: 'a1b2c3d\n', exitCode: 0 };
    if (command !== 'docker') throw Error('unexpected command');
    if (args[0] === 'compose') return { stdout: ids[args.at(-1)], exitCode: 0 };
    if (args[0] === 'inspect') {
      const name = args[1] === ids.postgres ? 'postgres' : args[1] === ids.redis ? 'redis' : 'web';
      return { stdout: JSON.stringify({
        Config: { Labels: {
          'com.docker.compose.project': 'test-canvas',
          'com.docker.compose.service': name,
          'com.docker.compose.project.working_dir': wrongProject ? '/other' : canvasDir
        } },
        State: { Running: !stopped.includes(name),
          Health: name === 'redis' ? { Status: redisUnhealthy ? 'unhealthy' : 'healthy' } : undefined }
      }), exitCode: 0 };
    }
    if (args[0] === 'logs') return {
      exitCode: 0,
      stdout: error
        ? 'PG::ForeignKeyViolation: terms_of_services foreign key constraint Key (account_id)=(100000000000001) sensitive_value=sensitive-fixture'
        : 'Canvas started normally'
    };
    if (args[0] === 'exec') {
      if (failedSql) return { exitCode: 1, stderr: 'database credentials: secret' };
      const input = options.input;
      let payload;
      if (input.includes("to_regclass('public.accounts')")) payload = {
        accountsExists: !schemaMissing,
        termsExists: true,
        shardsExists: true,
        migrationsExists: !missingMigrationHistory
      };
      else if (input.includes('FROM public.switchman_shards;')) payload = { shardCount: 1 };
      else if (input.includes('WHERE id = 100000000000001')) payload = { exists: false };
      else payload = {
        database: 'canvas_development', accountCount: 5, rootAccountCount: 3,
        defaultAccountExists: true, termsCount: 3, orphanTerms: 0,
        termsFkExists: true, unvalidatedForeignKeys: 0, shardsTableExists: true
      };
      return { exitCode: 0, stdout: JSON.stringify(payload) };
    }
    throw Error('unexpected docker command');
  });
  return { execute, calls };
}

describe('Opción 6: Canvas solo lectura', () => {
  it('verifica cuentas y shards sin escribir en PostgreSQL o ejecutar Docker up', async () => {
    const { pluginDir, canvasDir } = fixture();
    const mock = execution(canvasDir, { error: false });
    const { report, reportPath } = await diagnoseCanvasReadOnly({ pluginDir, canvasDir, execute: mock.execute });
    expect(report.status).toBe('healthy');
    expect(report.database.accountCount).toBe(5);
    expect(report.database.shardCount).toBe(1);
    expect(reportPath).toContain('canvas-readonly-');
    expect(fs.readFileSync(reportPath, 'utf8')).toContain('read-only');
    for (const call of mock.calls) {
      if (call.command !== 'docker') continue;
      expect(['compose', 'inspect', 'logs', 'exec']).toContain(call.args[0]);
      if (call.args[0] === 'compose') expect(call.args).toContain('ps');
      if (call.args[0] === 'exec') {
        expect(call.args.join(' ')).toContain('default_transaction_read_only=on');
        expect(call.options.input).toContain('BEGIN TRANSACTION READ ONLY;');
        expect(call.options.input).toContain('COMMIT;');
        expect(call.options.input).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b/i);
      }
    }
  });

  it('investiga un ID problemático sin copiar logs, contraseñas ni el ID al informe', async () => {
    const { pluginDir, canvasDir } = fixture();
    const mock = execution(canvasDir);
    const { report, reportPath } = await diagnoseCanvasReadOnly({ pluginDir, canvasDir, execute: mock.execute });
    expect(report.recentLoginFailure).toMatchObject({
      accountReferenceSeen: true, referenceExistsInAccounts: false, termsForeignKeyDetected: true
    });
    expect(report.status).toBe('warning');
    const contents = fs.readFileSync(reportPath, 'utf8');
    expect(contents).not.toContain('100000000000001');
    expect(contents).not.toContain('sensitive-fixture');
    if (process.platform !== 'win32') expect(fs.statSync(reportPath).mode & 0o777).toBe(0o600);
  });

  it('genera informe parcial cuando PostgreSQL y web están detenidos, sin iniciarlos', async () => {
    const { pluginDir, canvasDir } = fixture();
    const mock = execution(canvasDir, { stopped: ['postgres', 'web'] });
    const { report, reportPath } = await diagnoseCanvasReadOnly({ pluginDir, canvasDir, execute: mock.execute });
    expect(report.status).toBe('incomplete');
    expect(report.database).toBe(null);
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(mock.calls.some(c => c.args[0] === 'exec' || c.args[0] === 'start' || c.args[0] === 'logs')).toBe(false);
  });

  it('bloquea las consultas si la etiqueta de proyecto no coincide', async () => {
    const { pluginDir, canvasDir } = fixture();
    const mock = execution(canvasDir, { wrongProject: true });
    const { report } = await diagnoseCanvasReadOnly({ pluginDir, canvasDir, execute: mock.execute });
    expect(report.status).toBe('critical');
    expect(mock.calls.some(c => c.args[0] === 'exec')).toBe(false);
  });

  it('no divulga el stderr de un fallo de PostgreSQL', async () => {
    const { pluginDir, canvasDir } = fixture();
    const mock = execution(canvasDir, { failedSql: true });
    const { report, reportPath } = await diagnoseCanvasReadOnly({ pluginDir, canvasDir, execute: mock.execute });
    expect(report.status).toBe('incomplete');
    expect(fs.readFileSync(reportPath, 'utf8')).not.toContain('credentials: secret');
  });

  it('detecta Redis detenido, no lo reinicia ni escribe en sus datos', async () => {
    const { pluginDir, canvasDir } = fixture();
    const mock = execution(canvasDir, { stopped: ['redis'], error: false });
    const { report } = await diagnoseCanvasReadOnly({ pluginDir, canvasDir, execute: mock.execute });
    expect(report.status).toBe('incomplete');
    expect(report.checks.some(check => check.code === 'DOCKER_REDIS_STOPPED')).toBe(true);
    expect(mock.calls.some(call => ['start','stop','restart','rm','up'].includes(call.args[0]))).toBe(false);
  });

  it('notifica un Redis activo pero no saludable, sin autorrepararlo', async () => {
    const { pluginDir, canvasDir } = fixture();
    const mock = execution(canvasDir, { redisUnhealthy: true, error: false });
    const { report } = await diagnoseCanvasReadOnly({ pluginDir, canvasDir, execute: mock.execute });
    expect(report.status).toBe('incomplete');
    expect(report.checks.some(check => check.code === 'CANVAS-REDIS-001')).toBe(true);
    expect(mock.calls.some(call => ['start','restart','stop','rm'].includes(call.args[0]))).toBe(false);
  });

  it('avisa sobre historial de migración Canvas ausente, sin crear tablas', async () => {
    const { pluginDir, canvasDir } = fixture();
    const mock = execution(canvasDir, { missingMigrationHistory: true, error: false });
    const { report } = await diagnoseCanvasReadOnly({ pluginDir, canvasDir, execute: mock.execute });
    expect(report.status).toBe('warning');
    expect(report.checks.some(check => check.code === 'CANVAS-DB-SCHEMA-002')).toBe(true);
    expect(mock.calls.filter(call => call.args[0] === 'exec')
      .every(call => call.options.input.includes('BEGIN TRANSACTION READ ONLY'))).toBe(true);
  });

  it('bloquea un esquema histórico incompatible antes de consultar tablas ausentes', async () => {
    const { pluginDir, canvasDir } = fixture();
    const mock = execution(canvasDir, { schemaMissing: true, error: false });
    const { report, reportPath } = await diagnoseCanvasReadOnly({ pluginDir, canvasDir, execute: mock.execute });
    expect(report.status).toBe('critical');
    expect(report.checks.some(check => check.code === 'CANVAS-DB-SCHEMA-001')).toBe(true);
    expect(JSON.parse(fs.readFileSync(reportPath,'utf8')).database.schemaCatalog.accountsExists).toBe(false);
    const sql = mock.calls.filter(call => call.args[0] === 'exec').map(call => call.options.input).join(' ');
    expect(sql).not.toContain('COUNT(*) FROM public.accounts');
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
  });

  it('informa que no existe Canvas sin llamar Docker ni crear servicios', async () => {
    const { pluginDir, canvasDir } = fixture();
    fs.rmSync(path.join(canvasDir, 'docker-compose.yml'));
    const execute = vi.fn();
    const { report } = await diagnoseCanvasReadOnly({ pluginDir, canvasDir, execute });
    expect(report.status).toBe('incomplete');
    expect(execute).not.toHaveBeenCalled();
  });
});
