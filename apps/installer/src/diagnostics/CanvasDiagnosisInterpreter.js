/**
 * Read-only, deterministic interpretation of Canvas diagnostics.
 * Never interpolate raw Rails logs, exception messages, user IDs, credentials,
 * hostnames, account names, or free-form check messages into copyable output.
 */
const GUIDANCE = [
  {
    codes: ['DOCKER_POSTGRES_IDENTITY', 'DOCKER_WEB_IDENTITY', 'DOCKER_REDIS_IDENTITY'],
    component: 'Identidad de contenedores',
    title: 'El entorno Docker no coincide con la instalación esperada.',
    explanation: 'Uno o más contenedores pertenecen a otro proyecto o directorio. Intentar reutilizarlos sin revisar su origen podría modificar datos de una instalación diferente.',
    action: 'No iniciar, eliminar ni recrear contenedores como solución automática. Revisar el proyecto Compose, su ruta y el propietario de los servicios antes de continuar.'
  },
  {
    codes: ['CANVAS-DB-HISTORY-UNKNOWN'],
    component: 'Migraciones de Canvas',
    title: 'Se identificaron migraciones que no existen en el código disponible.',
    explanation: 'La base de datos conserva versiones de migración que este código de Canvas no reconoce. Esto puede indicar una versión diferente o un historial incompatible; no demuestra por sí solo corrupción.',
    action: 'No forzar migraciones ni modificar tablas. Revisar qué versión de Canvas creó esa base y su historial de migraciones, con un respaldo antes de cualquier actualización.'
  },
  {
    codes: ['CANVAS-DB-SCHEMA-001'],
    component: 'Estructura de base de datos',
    title: 'Faltan tablas necesarias o el esquema de Canvas es incompatible.',
    explanation: 'No se pudieron encontrar algunas estructuras indispensables para evaluar correctamente las cuentas, términos de servicio y shards.',
    action: 'Verificar la versión de Canvas y la base asociada. Evitar reinstalaciones y cambios de esquema hasta identificar la incompatibilidad.'
  },
  {
    codes: ['CANVAS_ROOT_ACCOUNT'],
    component: 'Cuentas institucionales',
    title: 'No se encontró la cuenta raíz esperada.',
    explanation: 'La estructura básica de cuentas de Canvas no coincide con la esperada por esta instalación; ciertas operaciones de autenticación podrían fallar.',
    action: 'Revisar la configuración institucional y el esquema de cuentas antes de realizar cambios en la base de datos.'
  },
  {
    codes: ['CANVAS_ORPHAN_TERMS'],
    component: 'Integridad referencial',
    title: 'Hay términos de servicio vinculados a cuentas inexistentes.',
    explanation: 'Existen referencias entre términos de servicio y cuentas que no se pueden resolver en la base inspeccionada. Es una inconsistencia concreta, pero se necesita contexto adicional para relacionarla con un inicio de sesión particular.',
    action: 'Conservar el informe e investigar las relaciones de cuentas, términos y shards. No borrar registros ni deshabilitar restricciones de clave foránea.'
  },
  {
    codes: ['CANVAS_FOREIGN_KEYS'],
    component: 'Restricciones de la base de datos',
    title: 'Hay restricciones de integridad ausentes o sin validar.',
    explanation: 'No se pudo confirmar que todas las restricciones relevantes de cuentas y términos estén presentes y validadas. Esto puede permitir o revelar relaciones inconsistentes.',
    action: 'Revisar el esquema y el historial de migraciones con las herramientas oficiales de Canvas antes de proponer una corrección.'
  },
  {
    codes: ['CANVAS_FILES'],
    levels: ['unavailable'],
    component: 'Archivos de Canvas',
    title: 'No se encontró una instalación local de Canvas verificable.',
    explanation: 'El directorio o el archivo Compose necesario para inspeccionar Canvas no está disponible en la ruta esperada. No se puede concluir si existe una instalación en otra ubicación.',
    action: 'Verificar la ubicación y configuración del repositorio de Canvas. El diagnóstico no instala ni busca automáticamente otra instancia.'
  },
  {
    codes: ['DOCKER_POSTGRES_STOPPED', 'DOCKER_WEB_STOPPED', 'DOCKER_REDIS_STOPPED'],
    component: 'Servicios de Canvas',
    title: 'Uno o más servicios requeridos de Canvas están detenidos.',
    explanation: 'Los contenedores identificados pertenecen al entorno, pero no están ejecutándose. Esto puede suceder después de apagar Docker, reiniciar el equipo o detener el sistema.',
    action: 'Si este Canvas está administrado por la instalación local de Plugin Feedback, se puede intentar el arranque habitual mediante la opción 3 y seguir únicamente las recuperaciones seguras que ofrezca. En un Canvas externo se debe utilizar su procedimiento oficial. Si el arranque falla, conservar el informe.'
  },
  {
    codes: ['CANVAS-REDIS-001'],
    component: 'Redis de Canvas',
    title: 'Redis está activo pero no se encuentra saludable.',
    explanation: 'El proceso Redis existe, pero su verificación de salud no confirma que esté listo para atender solicitudes. Esto podría afectar las sesiones o tareas de Canvas.',
    action: 'Revisar el estado y los logs de Redis con el administrador del entorno. No reiniciar ni borrar datos automáticamente desde la opción de diagnóstico.'
  },
  {
    codes: ['CANVAS_LAST_FK_ERROR', 'CANVAS_LAST_ERROR_ACCOUNT'],
    component: 'Inicio de sesión e integridad referencial',
    title: 'Los logs recientes muestran indicios de un error de clave foránea durante el inicio de sesión.',
    explanation: 'Una clave foránea es una regla que verifica la relación entre registros. Se identificó una excepción relacionada con términos de servicio y cuentas. La referencia podría pertenecer a un contexto global o a otro shard (una partición de datos); su presencia o ausencia en una tabla local no demuestra por sí sola la causa raíz.',
    action: 'Revisar el flujo de login, el contexto de cuenta y las asociaciones de shards usando el informe y los logs originales bajo acceso autorizado. La opción 3 no corrige por sí sola una relación de base de datos incorrecta.'
  },
  {
    codes: ['CANVAS-DB-HISTORY-PENDING'],
    component: 'Migraciones de Canvas',
    title: 'Hay migraciones de Canvas pendientes.',
    explanation: 'Una migración actualiza la estructura de la base de datos. El código disponible contiene migraciones que todavía no aparecen aplicadas; algunas funciones podrían depender de esos cambios.',
    action: 'Comparar versiones y seguir el procedimiento oficial de actualización, con respaldo y autorización, antes de ejecutar migraciones.'
  },
  {
    codes: ['CANVAS-DB-SCHEMA-002', 'CANVAS-DB-HISTORY-SOURCE', 'CANVAS-DB-HISTORY-READ'],
    component: 'Historial de migraciones',
    title: 'El historial de migraciones no pudo comprobarse completamente.',
    explanation: 'Falta una tabla o una fuente verificable para comparar el código y la base de datos. El diagnóstico no puede establecer que ambas versiones coincidan.',
    action: 'Verificar el repositorio, la conexión y la versión de Canvas. No asumir compatibilidad ni ejecutar migraciones basándose únicamente en este resultado.'
  },
  {
    codes: ['DOCKER_POSTGRES', 'DOCKER_WEB', 'DOCKER_REDIS', 'CANVAS_DATABASE', 'CANVAS-DB-SCHEMA-READ'],
    component: 'Disponibilidad de Canvas',
    title: 'Faltan componentes o permisos para terminar el diagnóstico.',
    explanation: 'No fue posible verificar todos los servicios o consultas requeridos. La ausencia de resultados no significa que los datos estén correctos ni dañados.',
    action: 'Verificar que Docker esté accesible y que Canvas se encuentre en funcionamiento. Repetir la opción 6 cuando el entorno esté disponible; si continúa incompleto, compartir el resumen.'
  },
  {
    codes: ['CANVAS_SHARDS'],
    component: 'Shards de Canvas',
    title: 'La estructura de shards no pudo comprobarse por completo.',
    explanation: 'La tabla de shards está ausente o no es legible en este entorno. No se puede determinar la distribución de cuentas entre bases o shards.',
    action: 'Revisar la versión de Switchman/Canvas y sus configuraciones antes de atribuir un error de cuentas a un shard específico.'
  }
];

const STATUS = {
  healthy: 'SALUDABLE',
  warning: 'ADVERTENCIA',
  critical: 'CRÍTICO',
  incomplete: 'INCOMPLETO'
};

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? String(value) : 'no evaluado';
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
    title: 'No se detectaron problemas en las verificaciones realizadas.',
    explanation: 'La estructura principal, los servicios y las comprobaciones disponibles no presentan anomalías. Esto no garantiza que todos los inicios de sesión, los flujos LTI ni las asociaciones entre shards funcionen en cualquier circunstancia.',
    action: 'Continuar con las pruebas habituales de la aplicación. Si se reproduce un error, conservar el informe y los registros relevantes para ampliar el diagnóstico.'
  } : {
    component: 'Evaluación incompleta o no clasificada',
    title: 'El diagnóstico identificó una situación que requiere revisión.',
    explanation: 'Existen advertencias o comprobaciones sin concluir, pero la evidencia disponible no permite asignar una causa técnica específica de forma segura.',
    action: 'Revisar los códigos de diagnóstico y compartir el resumen técnico. Evitar cambios destructivos o reparaciones no justificadas.'
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
  const revision = /^[a-f0-9]{7,16}$/i.test(report.canvasRevision || '') ? report.canvasRevision : 'no evaluada';
  const pluginRevision = /^[a-f0-9]{7,16}$/i.test(report.pluginRevision || '')
    ? report.pluginRevision : 'no evaluada';
  const date = typeof report.generatedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(report.generatedAt)
    ? report.generatedAt : 'no evaluada';
  const latestException = !report.recentLoginFailure
    ? 'no evaluado'
    : exceptionSeen ? 'detectado en la muestra reciente' : 'no observado en la muestra reciente';

  const serviceState = service => {
    const upper = service.toUpperCase();
    if (checks.some(check => check.code === `DOCKER_${upper}_RUNNING`)) return 'activo';
    if (checks.some(check => check.code === `DOCKER_${upper}_STOPPED`)) return 'detenido';
    if (service === 'redis' && checks.some(check => check.code === 'CANVAS-REDIS-001')) return 'no saludable';
    if (checks.some(check => check.code === `DOCKER_${upper}_IDENTITY`)) return 'identidad incompatible';
    return 'no verificado';
  };
  const reference = report.recentLoginFailure?.referenceExistsInAccounts;
  const accountContext = reference === true ? 'referencia encontrada en la tabla local' :
    reference === false ? 'referencia no encontrada en la tabla local (puede pertenecer a otro shard)' :
      'no evaluado';
  const lines = [
    `Diagnóstico: ${typeof report.diagnosticId === 'string' && /^[0-9a-f-]{36}$/i.test(report.diagnosticId) ? report.diagnosticId : 'sin identificador'}`,
    `Fecha (UTC): ${date}`,
    `Estado: ${STATUS[report.status] || 'INCOMPLETO'}`,
    `Hallazgo principal: ${codes.find(code => selected.codes?.includes(code)) || codes[0] || (noProblem ? 'CANVAS-CHECKS-OK' : 'CANVAS-CHECKS-INCOMPLETE')}`,
    `Componente: ${selected.component}`,
    `Comprobaciones: ${checks.length} (correctas: ${totals.ok}; advertencias: ${totals.warning}; críticas: ${totals.critical}; no disponibles: ${totals.unavailable})`,
    `Códigos relevantes: ${codes.length ? codes.slice(0, 8).join(', ') + (codes.length > 8 ? ` (+${codes.length - 8} más)` : '') : 'ninguno'}`,
    `Revisión Plugin Feedback: ${pluginRevision}`,
    `Cambios locales sin commit (archivos versionados): ${report.pluginTrackedChanges === true ? 'sí (revisar antes de git pull)' : report.pluginTrackedChanges === false ? 'no' : 'no evaluado'}`,
    `Revisión Canvas: ${revision}`,
    `Servicios Canvas: postgres=${serviceState('postgres')}; web=${serviceState('web')}; redis=${serviceState('redis')}`,
    `Cuentas raíz: ${safeCount(d.rootAccountCount)}; términos huérfanos: ${safeCount(d.orphanTerms)}; FK sin validar: ${safeCount(d.unvalidatedForeignKeys)}`,
    `Migraciones pendientes: ${safeCount(migration.pendingCount)}; desconocidas: ${safeCount(migration.unknownCount)}`,
    `Shards registrados: ${safeCount(d.shardCount)} (asociaciones no verificadas)`,
    `Error FK en logs recientes: ${latestException} (últimas 350 líneas / 24 h como máximo)`,
    `Referencia de cuenta del error: ${accountContext}`
  ];

  const limitations = [
    'La inspección no reproduce el inicio de sesión ni confirma las asociaciones reales entre shards.',
    'Los logs solo cubren una muestra reciente; no encontrar una excepción no demuestra que nunca haya ocurrido.'
  ];
  if (!report.database || report.status === 'incomplete') {
    limitations.push('Algunas verificaciones no se completaron: los datos ausentes no implican un resultado saludable.');
  }
  if (report.pluginTrackedChanges === true) {
    limitations.push('La copia de Plugin Feedback tiene cambios locales; antes de usar git pull se deben revisar para evitar conflictos o sobrescrituras.');
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
