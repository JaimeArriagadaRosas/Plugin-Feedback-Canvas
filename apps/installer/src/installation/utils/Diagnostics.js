import fs from 'node:fs';

const MAX_LOG_TAIL_BYTES = 64 * 1024;

const ERROR_SIGNATURES = [
  {
    pattern: /(?:PG::ForeignKeyViolation|ActiveRecord::InvalidForeignKey)[\s\S]{0,8000}terms_of_services|terms_of_services[\s\S]{0,8000}foreign key constraint/i,
    type: 'CANVAS_TERMS_FOREIGN_KEY',
    diagnosis: 'Canvas could not register terms of service because the referenced account is missing from the expected table. This does NOT prove the environment is outdated.',
    solution: 'Preserve the data. Check global and local IDs, the default account, shard and actual PostgreSQL server. Restart through option 3 only after reviewing the diagnosis; do not automatically delete volumes.'
  },
  {
    pattern: /Bind for (?:127\.0\.0\.1|0\.0\.0\.0):(\d+) failed: port is already allocated|listen tcp [^\n]*: bind: address already in use/i,
    type: 'HOST_PORT_OCCUPIED',
    diagnosis: 'Another container or process is already using a port required to start the environment.',
    solution: 'Identify the service occupying the port and its project. Stop only the appropriate service or choose separate ports. Do not delete databases or volumes.'
  },
  {
    pattern: /encryption key is incorrect/i,
    type: 'CANVAS_ENCRYPTION_KEY_MISMATCH',
    diagnosis: 'Canvas found an existing database encrypted with a different key.',
    solution: 'Do not rerun Yarn or asset building. Preserve and restore the ENCRYPTION_KEY used by that database, or explicitly reset local Canvas data only if it is disposable.'
  },
  {
    pattern: /INSECURE_UNFIXABLE:(.+)|INSECURE_REMAINING:(.+)|INSECURE_CHMOD_FAILED:(.+)|INSECURE_SCAN_FAILED:(.+)|world-writable and does not have the sticky bit set|unsafe to remove/i,
    type: 'CANVAS_GEM_CACHE_INSECURE_PERMISSIONS',
    diagnosis: 'The gem cache contains insecure world-writable directories that the installer could not normalize.',
    solution: 'Manually adjust volume permissions in WSL or verify ownership of the .gem directory.'
  },
  {
    pattern: /File not found with singular glob: (.+)/i,
    type: 'ARCHIVOS_PERDIDOS',
    diagnosis: 'The asset builder could not find a required file.',
    solution: 'Check Docker volumes: they must not hide Canvas source files.'
  },
  {
    pattern: /heap out of memory|ENOMEM|Killed/i,
    type: 'OUT_OF_MEMORY',
    diagnosis: 'Node.js or the build process ran out of RAM.',
    solution: 'Reduce concurrency, preserve Canvas resource limits and check Docker available memory.'
  },
  {
    pattern: /ECONNRESET|ESOCKETTIMEDOUT|ETIMEDOUT|network timeout|Failed to fetch/i,
    type: 'NETWORK_ERROR',
    diagnosis: 'Dependency downloads lost network connectivity.',
    solution: 'Retry when the network is stable; do not delete the clone or volumes before investigating the failure.'
  },
  {
    pattern: /PG::ConnectionBad|could not connect to server/i,
    type: 'DB_CONNECTION',
    diagnosis: 'Canvas PostgreSQL is not responding.',
    solution: 'Verify that the PostgreSQL container is healthy before repeating the step.'
  },
  {
    pattern: /error running gulp rev/i,
    type: 'GULP_REV_ERROR',
    diagnosis: 'Gulp failed while renaming final Canvas files.',
    solution: 'Find the missing file mentioned earlier in the log and verify the Canvas source tree is intact.'
  },
  {
    pattern: /Could not find gem '(.+)'|GemNotFound/i,
    type: 'MISSING_GEM',
    diagnosis: 'A Ruby gem required by Canvas is missing.',
    solution: 'Check bundle install and the gem cache state.'
  },
  {
    pattern: /The bundle is locked, but (.*) is missing|Please make sure you have checked (.*) into version control/i,
    type: 'MISSING_LOCKFILE',
    diagnosis: 'Bundler cannot find a required lockfile.',
    solution: 'Verify the clone and Bundler frozen configuration before running bundle install.'
  },
  {
    pattern: /Your bundle is locked to (.+), but that version could not be found/i,
    type: 'LOCKED_GEM_NOT_FOUND',
    diagnosis: 'Gemfile.lock refers to an unavailable gem.',
    solution: 'Check connectivity to rubygems.org and the Canvas version before updating dependencies.'
  },
  {
    pattern: /SyntaxError:.*in JSON/i,
    type: 'MALFORMED_JSON_CONFIG',
    diagnosis: 'A Canvas configuration JSON file is invalid.',
    solution: 'Fix the file indicated by the log before retrying.'
  },
  {
    pattern: /permission denied|eacces/i,
    type: 'PERMISSION_DENIED',
    diagnosis: 'The container attempted to access a file or directory without sufficient permissions.',
    solution: 'Verify ownership of mounted files. An earlier process running as root may have created files that now block access by the normal user inside the container.'
  }
];

/** Lee solo el final del archivo para que un log grande no eleve el uso de RAM. */
export function readLogTail(logFilePath, maxBytes = MAX_LOG_TAIL_BYTES) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const size = fs.statSync(logFilePath).size;
  const bytes = Math.min(size, maxBytes);
  const buffer = Buffer.alloc(bytes);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const descriptor = fs.openSync(logFilePath, 'r');
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.readSync(descriptor, buffer, 0, bytes, size - bytes);
  } finally {
    fs.closeSync(descriptor);
  }
  return buffer.toString('utf8');
}

/** Analiza una cadena de texto buscando errores conocidos. */
export function analyzeLogString(logString) {
  for (const signature of ERROR_SIGNATURES) {
    const match = logString.match(signature.pattern);
    if (match) return { ...signature, details: match[1] || '' };
  }
  const lastLines = logString.split('\n').filter((line) => line.trim()).slice(-15).join('\n  | ');
  return {
    type: 'UNKNOWN',
    diagnosis: 'The exact cause could not be determined automatically.',
    solution: `Review the end of the log:\n\n  | ${lastLines}`
  };
}

/** Busca errores conocidos sin cargar el registro completo en memoria. */
export function analyzeLogAndDiagnose(logFilePath, numLines = 150) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(logFilePath)) return null;
    const recentLog = readLogTail(logFilePath).split('\n').slice(-numLines).join('\n');
    return analyzeLogString(recentLog);
  } catch {
    return null;
  }
}

export function printDiagnosisBox(boot, diagnosisInfo) {
  boot.error('AUTOMATIC ERROR DIAGNOSIS (CODE 1)');
  boot.info(`DETECTED CAUSE: ${diagnosisInfo.diagnosis}`);
  if (diagnosisInfo.details) boot.debug(`TECHNICAL DETAIL: ${diagnosisInfo.details}`);
  boot.action(`RECOMMENDED SOLUTION: ${diagnosisInfo.solution}`);
}
