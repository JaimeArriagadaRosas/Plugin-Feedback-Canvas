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
  }
];

/**
 * Lee las últimas líneas de un log y busca firmas de errores conocidos.
 */
export function analyzeLogAndDiagnose(logFilePath, numLines = 150) {
  try {
    if (!fs.existsSync(logFilePath)) return null;
    
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

    return {
      type: 'UNKNOWN',
      diagnosis: 'Fallo genérico detectado o error desconocido.',
      solution: 'Revisa las últimas líneas del archivo de registro para buscar la causa principal.',
      details: ''
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
