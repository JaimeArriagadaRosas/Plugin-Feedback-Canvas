import fs from 'node:fs';

const ERROR_SIGNATURES = [
  {
    pattern: /File not found with singular glob: (.+)/i,
    type: 'ARCHIVOS_PERDIDOS',
    diagnosis: 'El compilador de Assets no pudo encontrar un archivo específico. Esto suele pasar si Docker oculta archivos del host con volúmenes mal configurados.',
    solution: 'Verifica que en docker-compose.override.yml no estés aislando la carpeta entera \'public\', sino específicamente \'public/dist\'.'
  },
  {
    pattern: /heap out of memory|ENOMEM|Killed/i,
    type: 'OUT_OF_MEMORY',
    diagnosis: 'El proceso (probablemente Node.js o Webpack) se quedó sin memoria RAM al intentar compilar.',
    solution: 'Aumenta la memoria límite en docker-compose.override.yml (ej. mem_limit: 4g) o reinicia Docker Desktop para liberar RAM.'
  },
  {
    pattern: /ECONNRESET|ESOCKETTIMEDOUT|ETIMEDOUT|network timeout|Failed to fetch/i,
    type: 'NETWORK_ERROR',
    diagnosis: 'Hubo una caída o interrupción de internet mientras se descargaban paquetes.',
    solution: 'El instalador intentará reconectarse automáticamente. Si falla del todo, revisa tu conexión a internet o intenta usar una VPN.'
  },
  {
    pattern: /PG::ConnectionBad|could not connect to server/i,
    type: 'DB_CONNECTION',
    diagnosis: 'La base de datos PostgreSQL de Canvas no está respondiendo o no ha terminado de encender.',
    solution: 'Asegúrate de que el contenedor de base de datos está corriendo. Si tu PC es lenta, a veces PostgreSQL tarda un par de minutos más en estar listo.'
  },
  {
    pattern: /error running gulp rev/i,
    type: 'GULP_REV_ERROR',
    diagnosis: 'Gulp falló al intentar renombrar los archivos finales de Canvas. Generalmente es consecuencia de un archivo que faltó en un paso anterior.',
    solution: 'Sube un poco más arriba en el log para ver qué archivo faltó exactamente. Asegúrate de tener el código fuente de Canvas intacto.'
  },
  {
    pattern: /Could not find gem '(.+)'|GemNotFound/i,
    type: 'MISSING_GEM',
    diagnosis: 'Falta una gema de Ruby necesaria para Canvas.',
    solution: 'El comando bundle install no se ejecutó correctamente o fue interrumpido.'
  },
  {
    pattern: /The bundle is locked, but (.*) is missing|Please make sure you have checked (.*) into version control/i,
    type: 'MISSING_LOCKFILE',
    diagnosis: 'El entorno de Ruby intentó instalar dependencias en modo estricto (frozen), pero faltan archivos de bloqueo (lockfiles) generados por bundler-multilock.',
    solution: 'Desactiva el modo frozen ejecutando `bundle config set --local frozen false` dentro del contenedor web antes de `bundle install`, o verifica que el clon del repositorio incluya los lockfiles necesarios.'
  },
  {
    pattern: /Your bundle is locked to (.+), but that version could not be found/i,
    type: 'LOCKED_GEM_NOT_FOUND',
    diagnosis: 'El Gemfile.lock referencia una versión de gema que no se puede encontrar en los repositorios remotos.',
    solution: 'Ejecute `bundle update` dentro del contenedor web para resolver las dependencias, o verifique la conectividad a rubygems.org.'
  },
  {
    pattern: /SyntaxError:.*in JSON/i,
    type: 'MALFORMED_JSON_CONFIG',
    diagnosis: 'Un archivo de configuración JSON (como .i18nrc o package.json) tiene errores de sintaxis, probablemente por una coma residual.',
    solution: 'Verifique y corrija el formato JSON en el archivo mencionado en el log (generalmente .i18nrc en la raíz de canvas-lms).'
  }
];

/**
 * Lee las últimas líneas de un log y busca firmas de errores conocidos.
 */
export function analyzeLogAndDiagnose(logFilePath, numLines = 150) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(logFilePath)) return null;
    
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const content = fs.readFileSync(logFilePath, 'utf-8');
    const lines = content.split('\n');
    const recentLog = lines.slice(-numLines).join('\n');

    for (const signature of ERROR_SIGNATURES) {
      const match = recentLog.match(signature.pattern);
      if (match) {
        return {
          type: signature.type,
          diagnosis: signature.diagnosis,
          solution: signature.solution,
          details: match[1] || ''
        };
      }
    }

    const filteredLines = content.split('\n').filter(l => l.trim().length > 0);
    const lastLines = filteredLines.slice(-15).join('\n  | ');

    return {
      type: 'UNKNOWN',
      diagnosis: 'No se pudo identificar la causa exacta del error de manera automática.',
      solution: `Por favor, revisa el archivo de registro. Aquí están las últimas líneas del log:\n\n  | ${lastLines}`
    };
  } catch (e) {
    return null;
  }
}

/**
 * Imprime el diagnóstico en la consola usando el logger boot.
 */
export function printDiagnosisBox(boot, diagnosisInfo) {
  boot.error('DIAGNÓSTICO AUTOMÁTICO DE ERROR (CÓDIGO 1)');
  boot.info(`CAUSA DETECTADA: ${diagnosisInfo.diagnosis}`);
  if (diagnosisInfo.details) {
    boot.debug(`DETALLE TÉCNICO: ${diagnosisInfo.details}`);
  }
  boot.action(`SOLUCIÓN RECOMENDADA: ${diagnosisInfo.solution}`);
}
