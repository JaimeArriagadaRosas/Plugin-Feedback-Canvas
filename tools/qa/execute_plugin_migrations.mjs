import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { execa } from 'execa';
import { runMigrations } from '../../packages/plugin-database/src/migrations/MigrationRunner.js';

const env = process.env;
const project = env.COMPOSE_PROJECT_NAME || '';
if (env.QA_DISPOSABLE_LAB !== 'true' ||
    env.PLUGIN_TEST_MODE !== 'true' || env.PLUGIN_QA_NO_BROWSER !== 'true' ||
    !/^qa-compat-[0-9a-f]{8}$/.test(project)) {
  throw new Error('No se autoriza ejecutar migraciones de prueba fuera de QA.');
}
const name = env.PLUGIN_DB_CONTAINER_NAME || '';
if (name !== project + '-db-1') throw new Error('Contenedor de PostgreSQL QA no reconocido.');

const inspection = await execa('docker', ['inspect', name, '--format', '{{json .}}']);
const data = JSON.parse(inspection.stdout);
const labels = data.Config?.Labels || {};
if (labels['com.docker.compose.project'] !== project ||
    labels['com.docker.compose.service'] !== 'db' ||
    data.Config?.Image !== 'postgres:15-alpine' ||
    !data.State?.Running) {
  throw new Error('Proyecto, imagen o estado de PostgreSQL QA no autorizado.');
}
const configuredPorts = data.NetworkSettings?.Ports?.['5432/tcp'] || [];
if (!configuredPorts.some(item => item.HostIp === '127.0.0.1' && item.HostPort === env.DB_PORT)) {
  throw new Error('Puerto de PostgreSQL QA no coincide con el contenedor verificado.');
}

const connectionConfig = {
  host: '127.0.0.1',
  port: Number(env.DB_PORT),
  user: 'postgres',
  password: env.DB_PASSWORD,
  database: 'feedback_plugin_db'
};
const logger = {
  start() {},
  noPending() {},
  migrationStart() {},
  migrationFailed() {},
  complete() {}
};
const repositoryRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const directory = path.join(repositoryRoot, 'packages/plugin-database/migrations');
const versions = fs.readdirSync(directory).filter(file => /^\d+_.*\.sql$/.test(file)).sort();
const result = [];

const client = new pg.Client(connectionConfig);
await client.connect();
const queryValue = async sql => (await client.query(sql)).rows[0];
const migrate = directoryPath => runMigrations({
  connectionConfig, migrationsDirectory: directoryPath, requireSafeHistory: true, reporter: logger
});
const runCase = async (name, fn) => {
  try {
    const detail = await fn();
    result.push({ name, status: 'PASS', detail });
  } catch (error) {
    result.push({ name, status: 'FAIL', detail: error.code || 'migration_failed' });
  }
};
const earlyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-plugin-migrations-'));
try {
  for (const file of versions.slice(0, 3)) {
    fs.copyFileSync(path.join(directory, file), path.join(earlyDir, file));
  }
  await runCase('plugin_legacy_prefix_install', async () => {
    await migrate(earlyDir);
    const { count } = await queryValue('SELECT count(*)::int AS count FROM public.schema_migrations');
    if (count !== 3) throw Error('unexpected_initial_schema');
    const inserted = await client.query(
      'INSERT INTO plantilla_feedback(nombre,contenido,activo,profesor_id) VALUES($1,$2,true,$3) RETURNING id',
      ['qa-compat-record', 'preserve-payload', 'test-professor']);
    if (inserted.rowCount !== 1) throw Error('test_record_not_inserted');
    return 'legacy_plugin_schema_and_record_created';
  });
  await runCase('plugin_legacy_migration_to_current', async () => {
    await migrate(directory);
    const { count } = await queryValue('SELECT count(*)::int AS count FROM public.schema_migrations');
    if (count !== versions.length) throw Error('migration_count_mismatch');
    const { preserved } = await queryValue(
      "SELECT COUNT(*)::int AS preserved FROM plantilla_feedback WHERE nombre='qa-compat-record' AND contenido='preserve-payload'");
    if (preserved !== 1) throw Error('persisted_data_changed');
    return 'official_plugin_migrations_completed_and_data_preserved';
  });
  await runCase('plugin_migrations_idempotent', async () => {
    const before = await queryValue('SELECT count(*)::int AS count FROM public.migration_logs');
    await migrate(directory);
    const after = await queryValue('SELECT count(*)::int AS count FROM public.migration_logs');
    if (before.count !== after.count) throw Error('unexpected_second_migration');
    return 'no_new_migration_logs_after_rerun';
  });
  await runCase('plugin_unknown_version_blocks_without_write', async () => {
    await client.query('INSERT INTO public.schema_migrations(version) VALUES($1)', ['999_unknown_external']);
    try {
      const previous = await queryValue('SELECT count(*)::int AS count FROM public.migration_logs');
      let rejected = false;
      try {
        await migrate(directory);
      } catch (error) {
        rejected = error.message.includes('PLUGIN-DB-HISTORY-001');
      }
      const after = await queryValue('SELECT count(*)::int AS count FROM public.migration_logs');
      if (!rejected || previous.count !== after.count) throw Error('schema_compatibility_guard_failed');
      return 'unknown_plugin_schema_version_blocked_without_migrations';
    } finally {
      await client.query('DELETE FROM public.schema_migrations WHERE version=$1', ['999_unknown_external']);
    }
  });
} finally {
  await client.end().catch(() => {});
  fs.rmSync(earlyDir, { recursive: true, force: true });
}
console.log('QA_PLUGIN_MIGRATION=' + JSON.stringify(result));
if (result.some(item => item.status !== 'PASS')) process.exitCode = 2;
