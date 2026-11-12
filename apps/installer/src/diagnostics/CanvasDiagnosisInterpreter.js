/**
 * Read-only, deterministic interpretation of Canvas diagnostics.
 * Never interpolate raw Rails logs, exception messages, user IDs, credentials,
 * hostnames, account names, or free-form check messages into copyable output.
 */
const GUIDANCE = [
  {
    codes: ['DOCKER_POSTGRES_IDENTITY', 'DOCKER_WEB_IDENTITY', 'DOCKER_REDIS_IDENTITY'],
    component: 'Container identity',
    title: 'The Docker environment does not match the expected installation.',
    explanation: 'One or more containers belong to another project or directory. Reusing them without verifying their origin could modify data from a different installation.',
    action: 'Do not automatically start, delete or recreate containers. Check the Compose project, its path and service ownership before continuing.'
  },
  {
    codes: ['CANVAS-DB-HISTORY-UNKNOWN'],
    component: 'Canvas migrations',
    title: 'Migrations not present in the available code were detected.',
    explanation: 'The database contains migration versions that this Canvas code does not recognize. This may indicate a different version or incompatible history; it does not, by itself, prove corruption.',
    action: 'Do not force migrations or modify tables. Identify which Canvas version created this database and review its migration history, with a backup before any upgrade.'
  },
  {
    codes: ['CANVAS-DB-SCHEMA-001'],
    component: 'Database schema',
    title: 'Required tables are missing or the Canvas schema is incompatible.',
    explanation: 'Some structures required to assess accounts, terms of service and shards could not be found.',
    action: 'Verify the Canvas version and associated database. Avoid reinstalls or schema changes until the incompatibility has been identified.'
  },
  {
    codes: ['CANVAS_ROOT_ACCOUNT'],
    component: 'Institutional accounts',
    title: 'The expected root account was not found.',
    explanation: 'The basic Canvas account structure differs from what this installation expects; some authentication operations may fail.',
    action: 'Review institutional configuration and the account schema before changing database records.'
  },
  {
    codes: ['CANVAS_ORPHAN_TERMS'],
    component: 'Referential integrity',
    title: 'Terms of service reference accounts that do not exist.',
    explanation: 'Some terms-of-service references cannot be resolved against accounts in the inspected database. This is a concrete inconsistency, but more context is needed to associate it with any particular login.',
    action: 'Preserve the report and investigate account, terms and shard relationships. Do not delete records or disable foreign-key constraints.'
  },
  {
    codes: ['CANVAS_FOREIGN_KEYS'],
    component: 'Database constraints',
    title: 'Integrity constraints are missing or unvalidated.',
    explanation: 'The diagnostic could not confirm that all relevant account and terms constraints exist and are validated. This may permit or reveal inconsistent relationships.',
    action: 'Review the schema and migration history with official Canvas tools before proposing a repair.'
  },
  {
    codes: ['CANVAS_FILES'],
    levels: ['unavailable'],
    component: 'Canvas files',
    title: 'No verifiable local Canvas installation was found.',
    explanation: 'The expected Canvas directory or Compose file is unavailable. This does not rule out an installation elsewhere.',
    action: 'Verify the location and configuration of the Canvas repository. The diagnostic does not install or automatically search for another instance.'
  },
  {
    codes: ['DOCKER_POSTGRES_STOPPED', 'DOCKER_WEB_STOPPED', 'DOCKER_REDIS_STOPPED'],
    component: 'Canvas services',
    title: 'One or more required Canvas services are stopped.',
    explanation: 'The identified containers belong to the environment but are not running. This can occur after shutting down Docker, rebooting or stopping the application.',
    action: 'For a local Canvas managed by Plugin Feedback, try the normal startup through option 3 and follow only its safe recovery prompts. For external Canvas use its official procedure. If startup fails, preserve the report.'
  },
  {
    codes: ['CANVAS-REDIS-001'],
    component: 'Canvas Redis',
    title: 'Redis is running but unhealthy.',
    explanation: 'The Redis process exists, but its health check does not confirm readiness to handle requests. This may affect Canvas sessions or background jobs.',
    action: 'Review Redis state and logs with the environment administrator. Do not automatically restart Redis or delete data from the diagnostic option.'
  },
  {
    codes: ['CANVAS_LAST_FK_ERROR', 'CANVAS_LAST_ERROR_ACCOUNT'],
    component: 'Login and referential integrity',
    title: 'Recent logs indicate a foreign-key error during login.',
    explanation: 'A foreign key enforces a relationship between records. An exception involving terms of service and accounts was detected. The reference may belong to a global context or another shard (data partition); its presence or absence in a local table alone does not establish the root cause.',
    action: 'Review the login flow, account context and shard associations using the report and authorized access to original logs. Option 3 alone cannot repair an inconsistent database relationship.'
  },
  {
    codes: ['CANVAS-DB-HISTORY-PENDING'],
    component: 'Canvas migrations',
    title: 'Canvas migrations are pending.',
    explanation: 'Migrations update database structure. Available code includes migrations that have not yet been applied; some features may depend on them.',
    action: 'Compare versions and follow the official upgrade procedure, with backup and approval, before applying migrations.'
  },
  {
    codes: ['CANVAS-DB-SCHEMA-002', 'CANVAS-DB-HISTORY-SOURCE', 'CANVAS-DB-HISTORY-READ'],
    component: 'Migration history',
    title: 'Migration history could not be fully verified.',
    explanation: 'A table or verifiable source needed to compare code and database is unavailable. The diagnostic cannot establish that their versions match.',
    action: 'Verify the repository, connection and Canvas version. Do not assume compatibility or apply migrations based solely on this result.'
  },
  {
    codes: ['DOCKER_POSTGRES', 'DOCKER_WEB', 'DOCKER_REDIS', 'CANVAS_DATABASE', 'CANVAS-DB-SCHEMA-READ'],
    component: 'Canvas availability',
    title: 'Components or permissions required for diagnosis are missing.',
    explanation: 'Not all required services or queries could be verified. Missing results do not mean the data are correct or corrupt.',
    action: 'Verify Docker access and that Canvas is running. Repeat option 6 when available; if still incomplete, share the support summary.'
  },
  {
    codes: ['CANVAS_SHARDS'],
    component: 'Canvas shards',
    title: 'The shard structure could not be completely verified.',
    explanation: 'The shard table is missing or unreadable. Account distribution across databases or shards cannot be determined.',
    action: 'Review Switchman/Canvas versions and configuration before attributing an account error to a specific shard.'
  }
];

const STATUS = {
  healthy: 'HEALTHY',
  warning: 'WARNING',
  critical: 'CRITICAL',
  incomplete: 'INCOMPLETE'
};

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? String(value) : 'not checked';
}

function safeCode(value) {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_-]{1,79}$/.test(value)
    ? value : null;
}

function matchingRule(rule, check) {
  return rule.codes.includes(check.code) &&
    (!rule.levels || rule.levels.includes(check.level));
}

function summarizeFindings(report) {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  const problemChecks = checks.filter(check => check.level !== 'ok');
  const codes = [...new Set(problemChecks.map(check => safeCode(check.code)).filter(Boolean))].slice(0, 30);
  const primary = GUIDANCE.find(rule => problemChecks.some(check => matchingRule(rule, check)));
  const exceptionSeen = report.recentLoginFailure?.termsForeignKeyDetected === true;
  const noProblem = problemChecks.length === 0 && report.status === 'healthy';
  const fallback = noProblem ? {
    component: 'Canvas LMS',
    title: 'No problems were detected in the completed checks.',
    explanation: 'The main schema, services and available checks show no anomalies. This does not guarantee that all logins, LTI flows or cross-shard associations work under every condition.',
    action: 'Continue normal application testing. If an error recurs, preserve the report and relevant records for further diagnosis.'
  } : {
    component: 'Incomplete or unclassified assessment',
    title: 'The diagnostic found a condition requiring review.',
    explanation: 'There are warnings or incomplete checks, but the available evidence does not safely establish a specific technical cause.',
    action: 'Review diagnostic codes and share the technical summary. Avoid destructive changes or unsupported repairs.'
  };
  const selected = primary || fallback;
  const totals = {
    ok: checks.filter(check => check.level === 'ok').length,
    warning: checks.filter(check => check.level === 'warning').length,
    critical: checks.filter(check => check.level === 'critical').length,
    unavailable: checks.filter(check => check.level === 'unavailable').length
  };
  const d = report.database && typeof report.database === 'object' ? report.database : {};
  const migration = report.migrationHistory && typeof report.migrationHistory === 'object' ? report.migrationHistory : {};
  const revision = /^[a-f0-9]{7,16}$/i.test(report.canvasRevision || '') ? report.canvasRevision : 'not checked';
  const pluginRevision = /^[a-f0-9]{7,16}$/i.test(report.pluginRevision || '')
    ? report.pluginRevision : 'not checked';
  const date = typeof report.generatedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(report.generatedAt)
    ? report.generatedAt : 'not checked';
  const latestException = !report.recentLoginFailure
    ? 'not checked'
    : exceptionSeen ? 'detected in the recent sample' : 'not observed in the recent sample';

  const serviceState = service => {
    const upper = service.toUpperCase();
    if (checks.some(check => check.code === `DOCKER_${upper}_RUNNING`)) return 'running';
    if (checks.some(check => check.code === `DOCKER_${upper}_STOPPED`)) return 'stopped';
    if (service === 'redis' && checks.some(check => check.code === 'CANVAS-REDIS-001')) return 'unhealthy';
    if (checks.some(check => check.code === `DOCKER_${upper}_IDENTITY`)) return 'identity mismatch';
    return 'unverified';
  };
  const reference = report.recentLoginFailure?.referenceExistsInAccounts;
  const accountContext = reference === true ? 'reference found in the local table' :
    reference === false ? 'reference not found in the local table (it may belong to another shard)' :
      'not checked';
  const lines = [
    `Diagnostic: ${typeof report.diagnosticId === 'string' && /^[0-9a-f-]{36}$/i.test(report.diagnosticId) ? report.diagnosticId : 'no identifier'}`,
    `Date (UTC): ${date}`,
    `Status: ${STATUS[report.status] || 'INCOMPLETE'}`,
    `Primary finding: ${codes.find(code => selected.codes?.includes(code)) || codes[0] || (noProblem ? 'CANVAS-CHECKS-OK' : 'CANVAS-CHECKS-INCOMPLETE')}`,
    `Component: ${selected.component}`,
    `Checks: ${checks.length} (passed: ${totals.ok}; warnings: ${totals.warning}; critical: ${totals.critical}; unavailable: ${totals.unavailable})`,
    `Relevant codes: ${codes.length ? codes.slice(0, 8).join(', ') + (codes.length > 8 ? ` (+${codes.length - 8} more)` : '') : 'none'}`,
    `Plugin Feedback revision: ${pluginRevision}`,
    `Uncommitted local changes (tracked files): ${report.pluginTrackedChanges === true ? 'yes (review before git pull)' : report.pluginTrackedChanges === false ? 'no' : 'not checked'}`,
    `Canvas revision: ${revision}`,
    `Canvas services: postgres=${serviceState('postgres')}; web=${serviceState('web')}; redis=${serviceState('redis')}`,
    `Root accounts: ${safeCount(d.rootAccountCount)}; orphaned terms: ${safeCount(d.orphanTerms)}; unvalidated FK: ${safeCount(d.unvalidatedForeignKeys)}`,
    `Pending migrations: ${safeCount(migration.pendingCount)}; unknown: ${safeCount(migration.unknownCount)}`,
    `Registered shards: ${safeCount(d.shardCount)} (associations not verified)`,
    `FK error in recent logs: ${latestException} (up to last 350 lines / 24 hours)`,
    `Error account reference: ${accountContext}`
  ];

  const limitations = [
    'Inspection does not reproduce login or confirm real associations between shards.',
    'Logs cover only a recent sample; absence of an exception does not prove it never occurred.'
  ];
  if (!report.database || report.status === 'incomplete') {
    limitations.push('Some checks were incomplete; missing data do not imply a healthy result.');
  }
  if (report.pluginTrackedChanges === true) {
    limitations.push('This Plugin Feedback checkout has local changes; review them before git pull to avoid conflicts or overwrites.');
  }
  return {
    status: report.status in STATUS ? report.status : 'incomplete',
    primaryCode: codes.find(code => selected.codes?.includes(code)) || codes[0] ||
      (noProblem ? 'CANVAS-CHECKS-OK' : 'CANVAS-CHECKS-INCOMPLETE'),
    component: selected.component,
    relevantCodes: codes,
    summaryLines: lines,
    title: selected.title,
    explanation: selected.explanation,
    nextStep: selected.action,
    limitations
  };
}

export function interpretCanvasDiagnosis(report) {
  return summarizeFindings(report);
}
