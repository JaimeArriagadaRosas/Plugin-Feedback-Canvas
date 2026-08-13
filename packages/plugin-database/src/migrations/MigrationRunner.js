import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import pg from 'pg';

import { createDatabaseConfig } from '../connection/databaseConfig.js';
import { MigrationProgressReporter } from './MigrationProgressReporter.js';

const { Client } = pg;
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(moduleDirectory, '../..');
const repositoryRoot = path.resolve(packageDirectory, '../..');
const defaultMigrationsDirectory = path.join(packageDirectory, 'migrations');
const advisoryLockId = 123456789;

async function ensureMigrationTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS migration_logs (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      version VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      logs TEXT,
      ejecutado_en TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function readPendingMigrations(client, migrationsDirectory) {
  const entries = await fs.readdir(migrationsDirectory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const result = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
  const executed = new Set(result.rows.map((row) => row.version));
  return files.filter((file) => !executed.has(file.replace(/\.sql$/u, '')));
}

async function recordFailure(client, version, error) {
  const details = `Error: ${error.message}\n${error.stack || ''}`;
  await client.query(
    'INSERT INTO migration_logs (version, status, logs) VALUES ($1, $2, $3)',
    [version, 'FAILED', details],
  ).catch(() => undefined);
}

async function applyMigration(client, migrationsDirectory, file, reporter, index) {
  const version = file.replace(/\.sql$/u, '');
  const sql = await fs.readFile(path.join(migrationsDirectory, file), 'utf8');
  reporter.migrationStart(index, file);

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    await client.query(
      'INSERT INTO migration_logs (version, status, logs) VALUES ($1, $2, $3)',
      [version, 'SUCCESS', `Ejecución exitosa de ${file}`],
    );
    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    await recordFailure(client, version, error);
    reporter.migrationFailed(index, file);
    throw error;
  }
}

export async function runMigrations(options = {}) {
  const migrationsDirectory = options.migrationsDirectory || defaultMigrationsDirectory;
  dotenv.config({ path: options.envPath || path.join(repositoryRoot, '.env') });
  const client = options.client || new Client(options.connectionConfig || createDatabaseConfig());
  const ownsClient = !options.client;
  const reporter = options.reporter || new MigrationProgressReporter();
  let lockAcquired = false;

  try {
    if (ownsClient) await client.connect();
    await client.query('SELECT pg_advisory_lock($1)', [advisoryLockId]);
    lockAcquired = true;
    await ensureMigrationTables(client);
    const pending = await readPendingMigrations(client, migrationsDirectory);
    if (pending.length === 0) reporter.noPending();
    else reporter.start(pending.length);
    for (const [index, file] of pending.entries()) {
      await applyMigration(client, migrationsDirectory, file, reporter, index + 1);
    }
    if (pending.length > 0) reporter.complete();
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock($1)', [advisoryLockId]).catch(() => undefined);
    }
    if (ownsClient) await client.end().catch(() => undefined);
  }
}
