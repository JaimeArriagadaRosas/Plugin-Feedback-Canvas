import fs from 'node:fs/promises';

export function assessMigrationHistory(knownVersions, appliedVersions) {
  const known = [...knownVersions].sort();
  const applied = [...appliedVersions];
  const unique = new Set(applied);

  if (unique.size !== applied.length) {
    return { status: 'blocked', code: 'PLUGIN-DB-HISTORY-003', reason: 'Historial de migraciones duplicado.' };
  }
  const unexpected = applied.filter(version => !known.includes(version));
  if (unexpected.length) {
    return { status: 'blocked', code: 'PLUGIN-DB-HISTORY-001', reason: 'La base contiene versiones de migración desconocidas.' };
  }
  const matchingPrefix = known.slice(0, applied.length);
  if (matchingPrefix.some(version => !unique.has(version))) {
    return { status: 'blocked', code: 'PLUGIN-DB-HISTORY-002', reason: 'El historial de migraciones no es un prefijo continuo.' };
  }
  return {
    status: applied.length === known.length ? 'up-to-date' : applied.length ? 'compatible-legacy' : 'clean',
    code: 'PLUGIN-DB-HISTORY-OK',
    appliedCount: applied.length,
    pendingCount: known.length - applied.length
  };
}

/** SELECT-only, within a read-only transaction. Does not create schema_migrations. */
export async function inspectMigrationCompatibility(client, migrationsDirectory) {
  const files = (await fs.readdir(migrationsDirectory))
    .filter(file => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
  const known = files.map(file => file.replace(/\.sql$/u, ''));

  await client.query('BEGIN TRANSACTION READ ONLY');
  try {
    const present = await client.query("SELECT to_regclass('public.schema_migrations') AS migration_table");
    const versions = present.rows[0]?.migration_table
      ? (await client.query('SELECT version FROM public.schema_migrations ORDER BY version')).rows.map(row => row.version)
      : [];
    const result = assessMigrationHistory(known, versions);
    await client.query('ROLLBACK');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
