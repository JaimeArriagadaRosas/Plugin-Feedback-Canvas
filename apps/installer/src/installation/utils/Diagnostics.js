import fs from 'node:fs';

const MAX_LOG_TAIL_BYTES = 64 * 1024;

const ERROR_SIGNATURES = [
  {
    pattern: /encryption key is incorrect/i,
    type: 'CANVAS_ENCRYPTION_KEY_MISMATCH',
    diagnosis: 'Canvas encontró una base de datos existente cifrada con otra clave.',
    solution: 'No repitas Yarn ni los assets. Conserva y restaura la ENCRYPTION_KEY usada por esa base de datos, o reinicia explícitamente los datos locales de Canvas si son descartables.'
  },
  {
    pattern: /File not found with singular glob: (.+)/i,
    type: 'ARCHIVOS_PERDIDOS',
    diagnosis: 'El compilador de assets no pudo encontrar un archivo específico.',
    solution: 'Revisa los volúmenes de Docker: no deben ocultar archivos fuente de Canvas.'
  },
  {
    pattern: /heap out of memory|ENOMEM|Killed/i,
    type: 'OUT_OF_MEMORY',
    diagnosis: 'Node.js o el compilador se quedó sin memoria RAM.',
    solution: 'Reduce concurrencia, conserva límites de Canvas y verifica la memoria disponible para Docker.'
  },
  {
    pattern: /ECONNRESET|ESOCKETTIMEDOUT|ETIMEDOUT|network timeout|Failed to fetch/i,
    type: 'NETWORK_ERROR',
    diagnosis: 'La descarga de dependencias perdió conectividad.',
    solution: 'Reintenta cuando la conexión sea estable; no borres el clon ni los volúmenes antes de revisar el fallo.'
  },
  {
    pattern: /PG::ConnectionBad|could not connect to server/i,
    type: 'DB_CONNECTION',
    diagnosis: 'PostgreSQL de Canvas no está respondiendo.',
    solution: 'Comprueba que el contenedor postgres esté sano antes de repetir el paso.'
  },
  {
    pattern: /error running gulp rev/i,
    type: 'GULP_REV_ERROR',
    diagnosis: 'Gulp falló al renombrar archivos finales de Canvas.',
    solution: 'Busca el archivo faltante indicado unas líneas antes y valida que el árbol de Canvas esté intacto.'
  },
  {
    pattern: /Could not find gem '(.+)'|GemNotFound/i,
    type: 'MISSING_GEM',
    diagnosis: 'Falta una gema de Ruby necesaria para Canvas.',
    solution: 'Verifica bundle install y el estado del caché de gemas.'
  },
  {
    pattern: /The bundle is locked, but (.*) is missing|Please make sure you have checked (.*) into version control/i,
    type: 'MISSING_LOCKFILE',
    diagnosis: 'Bundler no encuentra un archivo lock requerido.',
    solution: 'Verifica el clon y la configuración frozen de Bundler antes de ejecutar bundle install.'
  },
  {
    pattern: /Your bundle is locked to (.+), but that version could not be found/i,
    type: 'LOCKED_GEM_NOT_FOUND',
    diagnosis: 'Gemfile.lock referencia una gema no disponible.',
    solution: 'Revisa conectividad a rubygems.org y la versión de Canvas antes de actualizar dependencias.'
  },
  {
    pattern: /SyntaxError:.*in JSON/i,
    type: 'MALFORMED_JSON_CONFIG',
    diagnosis: 'Un JSON de configuración de Canvas no es válido.',
    solution: 'Corrige el archivo indicado en el log antes de reintentar.'
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

/** Busca errores conocidos sin cargar el registro completo en memoria. */
export function analyzeLogAndDiagnose(logFilePath, numLines = 150) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(logFilePath)) return null;
    const recentLog = readLogTail(logFilePath).split('\n').slice(-numLines).join('\n');
    for (const signature of ERROR_SIGNATURES) {
      const match = recentLog.match(signature.pattern);
      if (match) return { ...signature, details: match[1] || '' };
    }
    const lastLines = recentLog.split('\n').filter((line) => line.trim()).slice(-15).join('\n  | ');
    return {
      type: 'UNKNOWN',
      diagnosis: 'No se pudo identificar la causa exacta automáticamente.',
      solution: `Revisa el resumen final del registro:\n\n  | ${lastLines}`
    };
  } catch {
    return null;
  }
}

export function printDiagnosisBox(boot, diagnosisInfo) {
  boot.error('DIAGNÓSTICO AUTOMÁTICO DE ERROR (CÓDIGO 1)');
  boot.info(`CAUSA DETECTADA: ${diagnosisInfo.diagnosis}`);
  if (diagnosisInfo.details) boot.debug(`DETALLE TÉCNICO: ${diagnosisInfo.details}`);
  boot.action(`SOLUCIÓN RECOMENDADA: ${diagnosisInfo.solution}`);
}
