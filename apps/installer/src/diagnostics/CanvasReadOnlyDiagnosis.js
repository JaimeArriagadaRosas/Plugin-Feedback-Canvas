import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execa } from 'execa';
import { getCanvasDirectory } from '../installation/utils/LocalWorkspacePaths.js';

const MAX_OUTPUT = 1024 * 1024;
const TIMEOUT_MS = 10000;
const READ_ONLY_PG = '-c default_transaction_read_only=on';

const SQL_SCHEMA = `SELECT json_build_object(
  'accountsExists', to_regclass('public.accounts') IS NOT NULL,
  'termsExists', to_regclass('public.terms_of_services') IS NOT NULL,
  'shardsExists', to_regclass('public.switchman_shards') IS NOT NULL,
  'migrationsExists', to_regclass('public.schema_migrations') IS NOT NULL
);`;

const SQL_OVERVIEW = `SELECT json_build_object(
  'database', current_database(),
  'accountCount', (SELECT COUNT(*) FROM public.accounts),
  'rootAccountCount', (SELECT COUNT(*) FROM public.accounts WHERE root_account_id = 0 AND id > 0),
  'defaultAccountExists', (SELECT EXISTS(SELECT 1 FROM public.accounts WHERE id = 1)),
  'termsCount', (SELECT COUNT(*) FROM public.terms_of_services),
  'orphanTerms', (SELECT COUNT(*) FROM public.terms_of_services t LEFT JOIN public.accounts a ON a.id = t.account_id WHERE a.id IS NULL),
  'termsFkExists', (SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'fk_rails_337ba633a9')),
  'unvalidatedForeignKeys', (SELECT COUNT(*) FROM pg_constraint WHERE contype = 'f' AND NOT convalidated),
  'shardsTableExists', (SELECT to_regclass('public.switchman_shards') IS NOT NULL)
);`;

const limited = (value) => String(value || '').slice(0, MAX_OUTPUT);

async function run(execute, command, args, options = {}) {
  try {
    const result = await execute(command, args, {
      reject: false, timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT, ...options
    });
    return { ok: result.exitCode === undefined || result.exitCode === 0, stdout: limited(result.stdout), stderr: limited(result.stderr) };
  } catch {
    return { ok: false, stdout: '', stderr: '' };
  }
}

function add(report, code, level, message) {
  report.checks.push({ code, level, message });
}

function resultStatus(checks) {
  if (checks.some(c => c.level === 'critical')) return 'critical';
  if (checks.some(c => c.level === 'unavailable')) return 'incomplete';
  if (checks.some(c => c.level === 'warning')) return 'warning';
  return 'healthy';
}

function parseJsonResult(response) {
  if (!response.ok) return null;
  const line = response.stdout.split('\n').map(v => v.trim()).find(v => v.startsWith('{'));
  try { return line ? JSON.parse(line) : null; } catch { return null; }
}

function psqlArguments(containerId) {
  return ['exec', '-i', '-e', `PGOPTIONS=${READ_ONLY_PG}`, containerId, 'psql',
    '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'canvas_development'];
}

async function queryReadOnly(execute, containerId, select, cwd) {
  return run(execute, 'docker', psqlArguments(containerId), {
    cwd, input: `BEGIN TRANSACTION READ ONLY;\n${select}\nCOMMIT;\n`
  });
}

async function inspectService(execute, canvasDir, name, report) {
  const ps = await run(execute, 'docker', ['compose', 'ps', '-a', '-q', name], { cwd: canvasDir });
  const ids = ps.stdout.trim().split(/\s+/).filter(Boolean);
  if (!ps.ok || ids.length !== 1 || !/^[a-f0-9]{12,64}$/i.test(ids[0])) {
    add(report, `DOCKER_${name.toUpperCase()}`, 'unavailable', `No se identificó un único contenedor ${name} de este entorno. No se iniciarán servicios.`);
    return null;
  }
  const inspected = await run(execute, 'docker', ['inspect', ids[0], '--format', '{{json .}}'], { cwd: canvasDir });
  let obj;
  try { obj = JSON.parse(inspected.stdout); } catch { obj = null; }
  const labels = obj?.Config?.Labels || {};
  const service = labels['com.docker.compose.service'];
  const workingDir = labels['com.docker.compose.project.working_dir'];
  const owner = labels['com.docker.compose.project'];
  if (service !== name || !owner || !workingDir ||
      path.resolve(workingDir) !== path.resolve(canvasDir) ||
      (report.composeProject !== null && report.composeProject !== owner)) {
    add(report, `DOCKER_${name.toUpperCase()}_IDENTITY`, 'critical',
      `El contenedor ${name} no coincide con el directorio/proyecto Canvas esperado; inspección detenida por seguridad.`);
    return null;
  }
  report.composeProject = owner;
  if (!obj.State?.Running) {
    add(report, `DOCKER_${name.toUpperCase()}_STOPPED`, 'unavailable',
      `El contenedor ${name} está detenido. No se reiniciará automáticamente.`);
    return null;
  }
  if (name === 'redis' && obj.State?.Health?.Status &&
      obj.State.Health.Status !== 'healthy') {
    add(report, 'CANVAS-REDIS-001', 'unavailable',
      'Redis está activo pero su comprobación de salud no es satisfactoria; no se reparó.');
    return null;
  }
  add(report, `DOCKER_${name.toUpperCase()}_RUNNING`, 'ok', `Contenedor ${name} activo y verificado.`);
  return ids[0];
}

function lastAccountReference(logOutput) {
  const matches = [...logOutput.matchAll(/Key\s*\(account_id\)\s*=\s*\((\d{1,18})\)/ig)];
  return matches.at(-1)?.[1] || null;
}

function saveReport(report, pluginDir) {
  const directory = path.join(pluginDir, 'logs', 'canvas-diagnostics');
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const location = path.join(directory, `canvas-readonly-${Date.now()}-${randomUUID()}.json`);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(location, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return location;
  } catch { return null; }
}

export function assessCanvasMigrationVersions(sourceVersions, appliedVersions) {
  const known = new Set(sourceVersions);
  const applied = new Set(appliedVersions);
  const unknown = [...applied].filter(version => !known.has(version));
  const pending = [...known].filter(version => !applied.has(version));
  return {
    status: unknown.length ? 'blocked' : pending.length ? 'review_required' : 'compatible',
    sourceCount: known.size, appliedCount: applied.size,
    pendingCount: pending.length, unknownCount: unknown.length
  };
}

async function inspectCanvasVersionHistory(execute, postgres, canvasDir, report) {
  const directory = path.join(canvasDir, 'db', 'migrate');
  // A partially cloned Canvas tree may not have migration files yet.
  if (!fs.existsSync(directory)) return;
  let files;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    files = fs.readdirSync(directory).filter(file => /^\d{8,22}_.+\.rb$/.test(file));
  } catch {
    add(report, 'CANVAS-DB-HISTORY-SOURCE', 'unavailable', 'No se pudo leer el código de migraciones de Canvas.');
    return;
  }
  // Canvas ships one sentinel migration that only runs under Rails.env.test.
  // Exclude it ONLY when both its known filename and guard match.
  const testOnlyFile = '99999999999999999999_ensure_test_db_empty.rb';
  const sentinelPath = path.join(directory, testOnlyFile);
  let isTestOnly = false;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    isTestOnly = files.includes(testOnlyFile) && fs.readFileSync(sentinelPath, 'utf8').includes('Rails.env.test?');
  } catch { /* Include unreadable migration instead of suppressing it silently. */ }
  const versions = files.filter(file => !isTestOnly || file !== testOnlyFile).map(file => file.split('_', 1)[0]);
  if (!versions.length) {
    add(report, 'CANVAS-DB-HISTORY-SOURCE', 'unavailable', 'No hay migraciones de Canvas verificables.');
    return;
  }
  const statement = "SELECT json_build_object('versions', COALESCE(json_agg(version ORDER BY version), '[]'::json)) FROM public.schema_migrations;";
  const result = parseJsonResult(await queryReadOnly(execute, postgres, statement, canvasDir));
  if (!Array.isArray(result?.versions)) {
    add(report, 'CANVAS-DB-HISTORY-READ', 'unavailable', 'No se pudo leer el historial de migraciones en modo solo lectura.');
    return;
  }
  const audit = assessCanvasMigrationVersions(versions, result.versions.map(String));
  report.migrationHistory = audit;
  if (audit.unknownCount > 0) {
    add(report, 'CANVAS-DB-HISTORY-UNKNOWN', 'critical',
      'La base contiene versiones de migración que no aparecen en este código. Se bloquea cualquier reparación automática.');
  } else if (audit.pendingCount > 0) {
    add(report, 'CANVAS-DB-HISTORY-PENDING', 'warning',
      'Hay migraciones de Canvas pendientes. Revise el procedimiento oficial y el respaldo antes de actualizar.');
  } else {
    add(report, 'CANVAS-DB-HISTORY-OK', 'ok', 'El historial de migraciones coincide con el código disponible.');
  }
}

async function inspectCanvasCatalog(execute, postgres, canvasDir, report) {
  const catalog = parseJsonResult(await queryReadOnly(execute, postgres, SQL_SCHEMA, canvasDir));
  if (!catalog) {
    add(report, 'CANVAS-DB-SCHEMA-READ', 'unavailable',
      'No fue posible inspeccionar el catálogo de Canvas en modo solo lectura.');
    return false;
  }
  if (!catalog.accountsExists || !catalog.termsExists || !catalog.shardsExists) {
    add(report, 'CANVAS-DB-SCHEMA-001', 'critical',
      'El esquema de Canvas está incompleto o utiliza tablas incompatibles. No se ejecutarán migraciones.');
    report.database = { schemaCatalog: catalog };
    return false;
  }
  if (!catalog.migrationsExists) {
    add(report, 'CANVAS-DB-SCHEMA-002', 'warning',
      'No se encontró el historial de migraciones de Canvas. Se requiere revisión antes de actualizar.');
  } else {
    await inspectCanvasVersionHistory(execute, postgres, canvasDir, report);
  }
  return true;
}

/** No npm start, compose up, migrations, Rails runner, cleanup or database writes. */
export async function diagnoseCanvasReadOnly({
  pluginDir, canvasDir = getCanvasDirectory(), execute = execa,
  now = () => new Date().toISOString()
} = {}) {
  if (!pluginDir) throw new Error('Se requiere el directorio de Plugin Feedback.');
  const report = {
    schemaVersion: 1, generatedAt: now(), mode: 'read-only',
    status: 'incomplete', composeProject: null,
    checks: [], database: null, recentLoginFailure: null,
    note: 'Los resultados describen observaciones; no confirman una causa raíz. Solo se escribe este informe local.'
  };
  const compose = path.join(canvasDir, 'docker-compose.yml');
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!fs.existsSync(compose)) {
    add(report, 'CANVAS_FILES', 'unavailable', 'No se encontró el archivo Docker Compose de Canvas.');
  } else {
    add(report, 'CANVAS_FILES', 'ok', 'Archivos de Canvas disponibles.');
    const revision = await run(execute, 'git', ['-C', canvasDir, 'rev-parse', '--short', 'HEAD']);
    report.canvasRevision = revision.ok && /^[a-f\d]{7,16}$/i.test(revision.stdout.trim())
      ? revision.stdout.trim() : null;
    const postgres = await inspectService(execute, canvasDir, 'postgres', report);
    const web = await inspectService(execute, canvasDir, 'web', report);
    // Observe Redis; never restart or recreate it from the diagnosis.
    await inspectService(execute, canvasDir, 'redis', report);
    let reference = null;
    if (web) {
      const logs = await run(execute, 'docker', ['logs', '--since', '24h', '--tail', '350', web]);
      if (logs.ok) {
        const sample = logs.stdout + '\n' + logs.stderr;
        reference = lastAccountReference(sample);
        report.recentLoginFailure = {
          checkedLastLines: 350,
          termsForeignKeyDetected: /(?:PG::ForeignKeyViolation|ActiveRecord::InvalidForeignKey)[\s\S]{0,4000}terms_of_services|terms_of_services[\s\S]{0,4000}foreign key/i.test(sample),
          accountReferenceSeen: Boolean(reference)
        };
        add(report, 'RAILS_LOGS', 'ok', 'Se revisó una muestra reciente de logs sin conservar su contenido.');
      } else {
        add(report, 'RAILS_LOGS', 'unavailable', 'No fue posible inspeccionar los logs recientes de Rails.');
      }
    }
    if (postgres) {
      if (!(await inspectCanvasCatalog(execute, postgres, canvasDir, report))) {
        report.status = resultStatus(report.checks);
        return { report, reportPath: saveReport(report, pluginDir) };
      }
      const response = await queryReadOnly(execute, postgres, SQL_OVERVIEW, canvasDir);
      const overview = parseJsonResult(response);
      if (!overview || !Number.isInteger(overview.accountCount) || !Number.isInteger(overview.termsCount)) {
        add(report, 'CANVAS_DATABASE', 'unavailable', 'No se pudo consultar el esquema esperado en modo solo lectura.');
      } else {
        report.database = overview;
        add(report, 'CANVAS_DATABASE', 'ok', 'Conexión y consultas SELECT completadas con transacción READ ONLY.');
        if (!overview.defaultAccountExists || overview.rootAccountCount < 1) {
          add(report, 'CANVAS_ROOT_ACCOUNT', 'critical', 'No se encontró la cuenta raíz esperada.');
        } else {
          add(report, 'CANVAS_ROOT_ACCOUNT', 'ok', 'La cuenta raíz predeterminada existe.');
        }
        if (overview.orphanTerms > 0) {
          add(report, 'CANVAS_ORPHAN_TERMS', 'critical', 'Hay términos de servicio asociados a cuentas inexistentes.');
        } else {
          add(report, 'CANVAS_ORPHAN_TERMS', 'ok', 'No se encontraron términos de servicio huérfanos.');
        }
        if (!overview.termsFkExists || overview.unvalidatedForeignKeys > 0) {
          add(report, 'CANVAS_FOREIGN_KEYS', 'warning', 'Hay restricciones ausentes o pendientes de validar.');
        } else {
          add(report, 'CANVAS_FOREIGN_KEYS', 'ok', 'La restricción de términos existe y no hay FK sin validar.');
        }
        if (overview.shardsTableExists) {
          const shards = parseJsonResult(await queryReadOnly(execute, postgres,
            "SELECT json_build_object('shardCount', COUNT(*)) FROM public.switchman_shards;", canvasDir));
          if (shards && Number.isInteger(shards.shardCount)) {
            report.database.shardCount = shards.shardCount;
            add(report, 'CANVAS_SHARDS', 'ok', 'Se obtuvo el número de shards registrados (sin validar sus asociaciones).');
          } else {
            add(report, 'CANVAS_SHARDS', 'unavailable', 'La tabla de shards existe, pero no se pudo leer.');
          }
        } else {
          add(report, 'CANVAS_SHARDS', 'warning', 'No se encontró la tabla de shards esperada.');
        }
        if (reference) {
          const lookup = parseJsonResult(await queryReadOnly(execute, postgres,
            `SELECT json_build_object('exists', EXISTS (SELECT 1 FROM public.accounts WHERE id = ${reference}));`, canvasDir));
          report.recentLoginFailure ??= {};
          report.recentLoginFailure.referenceExistsInAccounts = lookup?.exists ?? null;
          add(report, 'CANVAS_LAST_ERROR_ACCOUNT', lookup === null ? 'unavailable' : lookup.exists ? 'ok' : 'warning',
            lookup === null ? 'No se pudo verificar la referencia del último error.' :
              lookup.exists ? 'La referencia aparece en accounts de la base consultada.' :
                'La referencia del error reciente no aparece en accounts de esta base; revisar shard y contexto.');
        }
      }
    }
  }
  report.status = resultStatus(report.checks);
  return { report, reportPath: saveReport(report, pluginDir) };
}
