import fs from 'node:fs';

const MAX_LOG_TAIL_BYTES = 64 * 1024;

const ERROR_SIGNATURES = [
  {
    pattern: /encryption key is incorrect/i,
    type: 'CANVAS_ENCRYPTION_KEY_MISMATCH',
    diagnosis: 'Canvas found an existing database encrypted with another key.',
    solution: 'Do not repeat Yarn or assets. Keep and restore the ENCRYPTION_KEY used by that database, or explicitly reset the local Canvas data if it is disposable.'
  },
  {
    pattern: /INSECURE_UNFIXABLE:(.+)|INSECURE_REMAINING:(.+)|INSECURE_CHMOD_FAILED:(.+)|INSECURE_SCAN_FAILED:(.+)|world-writable and does not have the sticky bit set|unsafe to remove/i,
    type: 'CANVAS_GEM_CACHE_INSECURE_PERMISSIONS',
    diagnosis: 'The gem cache retains one or more directories with insecure world-writable permissions that the installer could not normalize.',
    solution: 'Manually adjust volume permissions in WSL or verify ownership of the .gem directory.'
  },
  {
    pattern: /File not found with singular glob: (.+)/i,
    type: 'ARCHIVOS_PERDIDOS',
    diagnosis: 'The asset compiler could not find a specific file.',
    solution: 'Check Docker volumes: they must not hide Canvas source files.'
  },
  {
    pattern: /heap out of memory|ENOMEM|Killed/i,
    type: 'OUT_OF_MEMORY',
    diagnosis: 'Node.js or the compiler ran out of RAM.',
    solution: 'Reduce concurrency, keep Canvas limits and verify available memory for Docker.'
  },
  {
    pattern: /429 Too Many Requests|HTTP 429|rate limit/i,
    type: 'REMOTE_RATE_LIMIT',
    diagnosis: 'A remote server (e.g. GitHub) rejected the download request due to rate limiting (HTTP 429).',
    solution: 'Wait a few minutes for the rate limit to reset, then retry. Yarn will reuse its cache so the next attempt will be faster. Do not delete node_modules or the clone.'
  },
  {
    pattern: /ECONNRESET|ESOCKETTIMEDOUT|ETIMEDOUT|network timeout|Failed to fetch/i,
    type: 'NETWORK_ERROR',
    diagnosis: 'Dependency download lost connectivity.',
    solution: 'Retry when the connection is stable; do not delete the clone or volumes before reviewing the failure.'
  },
  {
    pattern: /PG::ConnectionBad|could not connect to server/i,
    type: 'DB_CONNECTION',
    diagnosis: 'Canvas PostgreSQL is not responding.',
    solution: 'Verify that the postgres container is healthy before repeating the step.'
  },
  {
    pattern: /error running gulp rev/i,
    type: 'GULP_REV_ERROR',
    diagnosis: 'Gulp failed to rename final Canvas files.',
    solution: 'Look for the missing file indicated a few lines above and validate that the Canvas tree is intact.'
  },
  {
    pattern: /Could not find gem '(.+)'|GemNotFound/i,
    type: 'MISSING_GEM',
    diagnosis: 'A Ruby gem required by Canvas is missing.',
    solution: 'Verify bundle install and the gem cache state.'
  },
  {
    pattern: /The bundle is locked, but (.*) is missing|Please make sure you have checked (.*) into version control/i,
    type: 'MISSING_LOCKFILE',
    diagnosis: 'Bundler cannot find a required lockfile.',
    solution: 'Verify clone and frozen Bundler configuration before running bundle install.'
  },
  {
    pattern: /Your bundle is locked to (.+), but that version could not be found/i,
    type: 'LOCKED_GEM_NOT_FOUND',
    diagnosis: 'Gemfile.lock references an unavailable gem.',
    solution: 'Check connectivity to rubygems.org and Canvas version before updating dependencies.'
  },
  {
    pattern: /SyntaxError:.*in JSON/i,
    type: 'MALFORMED_JSON_CONFIG',
    diagnosis: 'A Canvas configuration JSON is invalid.',
    solution: 'Fix the file indicated in the log before retrying.'
  },
  {
    pattern: /permission denied|eacces/i,
    type: 'PERMISSION_DENIED',
    diagnosis: 'The container attempted to access a file or directory but lacks permissions.',
    solution: 'Verify the ownership of mounted files. A previous process running as root may have created files that now block access for the normal container user.'
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
    diagnosis: 'Could not automatically identify the exact cause.',
    solution: `Review the final log summary:\n\n  | ${lastLines}`
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
