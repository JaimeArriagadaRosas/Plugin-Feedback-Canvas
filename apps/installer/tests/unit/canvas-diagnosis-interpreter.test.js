import { describe, it, expect } from 'vitest';
import { interpretCanvasDiagnosis } from '../../src/diagnostics/CanvasDiagnosisInterpreter.js';

const basic = (codes = [], more = {}) => ({
  status: codes.length ? 'warning' : 'healthy',
  diagnosticId: '12345678-1234-4234-9234-123456789abc',
  canvasRevision: '2e2b4a46',
  checks: [
    { code:'CANVAS_DATABASE', level:'ok', message:'Conexión correcta' },
    { code:'DOCKER_POSTGRES_RUNNING', level:'ok', message:'PostgreSQL ok' },
    { code:'DOCKER_WEB_RUNNING', level:'ok', message:'Canvas web ok' },
    { code:'DOCKER_REDIS_RUNNING', level:'ok', message:'Redis ok' },
    ...codes.map(code=>({code,level:
      code.endsWith('STOPPED') || code === 'CANVAS-REDIS-001' ? 'unavailable' : 'warning',
      message:'El detalle puede contener información sensible: SECRET-MOCK-ABC'}))
  ],
  database: {rootAccountCount:1,orphanTerms:0,unvalidatedForeignKeys:0,shardCount:2},
  migrationHistory: {pendingCount:0,unknownCount:0},
  recentLoginFailure:{checkedLastLines:350,termsForeignKeyDetected:false,accountReferenceSeen:false},
  ...more
});
const visible = result => [
  ...result.summaryLines, result.title, result.explanation,
  result.nextStep, ...result.limitations
].join('\n');

describe('Diagnóstico Canvas: explicación universal, técnica y copiable', () => {
  it('1: saludable informa el alcance sin garantizar que LTI o shards funcionen', () => {
    const diagnosis = interpretCanvasDiagnosis(basic());
    expect(diagnosis.status).toBe('healthy');
    expect(diagnosis.primaryCode).toBe('CANVAS-CHECKS-OK');
    expect(diagnosis.nextStep).toContain('pruebas habituales');
    expect(diagnosis.explanation).toMatch(/no garantiza/i);
    expect(visible(diagnosis)).toContain('Shards registrados: 2 (asociaciones no verificadas)');
    expect(visible(diagnosis)).toContain('Servicios Canvas: postgres=activo; web=activo; redis=activo');
  });

  it('2: servicios detenidos solo sugiere opción 3 para Canvas local administrado', () => {
    const check = basic(['DOCKER_POSTGRES_STOPPED'],{status:'incomplete'});
    const diagnosis=interpretCanvasDiagnosis(check);
    expect(diagnosis.primaryCode).toBe('DOCKER_POSTGRES_STOPPED');
    expect(diagnosis.nextStep).toContain('opción 3');
    expect(diagnosis.nextStep).toContain('Canvas externo');
  });

  it('3: el error FK reciente advierte sobre shards y NO promete reparación', () => {
    const report=basic(['CANVAS_LAST_FK_ERROR','CANVAS_LAST_ERROR_ACCOUNT'],{
      recentLoginFailure:{
        checkedLastLines:350, termsForeignKeyDetected:true,
        accountReferenceSeen:true, referenceExistsInAccounts:false
      }
    });
    const diagnosis=interpretCanvasDiagnosis(report);
    expect(diagnosis.primaryCode).toBe('CANVAS_LAST_FK_ERROR');
    expect(diagnosis.explanation).toContain('no demuestra');
    expect(diagnosis.nextStep).toContain('no corrige por sí sola');
    expect(visible(diagnosis)).toContain('referencia no encontrada en la tabla local');
    expect(visible(diagnosis)).toContain('detectado en la muestra reciente');
  });

  it.each([
    ['CANVAS-DB-HISTORY-UNKNOWN', 'Migraciones de Canvas', 'No forzar migraciones'],
    ['CANVAS-DB-SCHEMA-001','Estructura de base de datos','Evitar reinstalaciones'],
    ['CANVAS_ROOT_ACCOUNT','Cuentas institucionales','Revisar la configuración institucional'],
    ['CANVAS_ORPHAN_TERMS','Integridad referencial','No borrar registros'],
    ['CANVAS_FOREIGN_KEYS','Restricciones de la base de datos','historial de migraciones'],
    ['CANVAS-DB-HISTORY-PENDING','Migraciones de Canvas','respaldo'],
    ['CANVAS-REDIS-001','Redis de Canvas','No reiniciar ni borrar datos'],
    ['CANVAS_SHARDS','Shards de Canvas','Switchman/Canvas'],
    ['CANVAS-DB-SCHEMA-002','Historial de migraciones','No asumir compatibilidad']
  ])('asigna guía específica a %s', (code, component, nextStep) => {
    const output=interpretCanvasDiagnosis(basic([code],{status:'warning'}));
    expect(output.primaryCode).toBe(code);
    expect(output.component).toBe(component);
    expect(output.nextStep).toContain(nextStep);
  });

  it('señala cambios locales sin exponer rutas ni contenido de archivos', () => {
    const diagnosis=interpretCanvasDiagnosis(basic([], { pluginTrackedChanges:true }));
    expect(visible(diagnosis)).toContain('Cambios locales sin commit (archivos versionados): sí');
    expect(diagnosis.limitations.join(' ')).toContain('antes de usar git pull');
  });

  it('no divulga datos ocultos incluidos en mensajes ni atributos externos', () => {
    const report=basic(['CANVAS_LAST_FK_ERROR', 'CANVAS_FOREIGN_KEYS'],{
      canvasRevision:'localhost?token=SENSITIVE',
      composeProject:'secret-company-project',
      recentLoginFailure:{ termsForeignKeyDetected:true, accountReferenceSeen:true,
        accountReference:'100000000000001', rawLog:'password=real-secret-123'},
      database:{rootAccountCount:1,orphanTerms:0,unvalidatedForeignKeys:0,shardCount:2,
        rawMessage:'password=real-secret-123'},
      rawFailureMessage:'Bearer super-secret'
    });
    const out=visible(interpretCanvasDiagnosis(report));
    for (const fragment of ['SECRET-MOCK-ABC','password=real-secret-123',
      'secret-company-project','100000000000001','super-secret',
      'localhost?token=SENSITIVE']) expect(out).not.toContain(fragment);
    expect(out).toContain('Revisión Canvas: no evaluada');
  });

  it('no eleva automáticamente un diagnóstico incompleto a saludable', () => {
    const report=basic([], { status:'incomplete', database:null, recentLoginFailure:null });
    const diagnosis=interpretCanvasDiagnosis(report);
    expect(diagnosis.status).toBe('incomplete');
    expect(diagnosis.primaryCode).toBe('CANVAS-CHECKS-INCOMPLETE');
    expect(visible(diagnosis)).toContain('no evaluado');
    expect(diagnosis.limitations).toContain('Algunas verificaciones no se completaron: los datos ausentes no implican un resultado saludable.');
  });

  it('prioriza fallos de propiedad sobre errores generales', () => {
    const report=basic(['CANVAS_LAST_FK_ERROR','DOCKER_POSTGRES_IDENTITY'],{status:'critical'});
    const diagnosis=interpretCanvasDiagnosis(report);
    expect(diagnosis.primaryCode).toBe('DOCKER_POSTGRES_IDENTITY');
    expect(diagnosis.nextStep).toContain('No iniciar, eliminar ni recrear');
    expect(diagnosis.relevantCodes).toContain('CANVAS_LAST_FK_ERROR');
  });

  it('no imprime un código malicioso y limita la salida de hallazgos', () => {
    const report=basic([]);
    report.checks.push({code:'USER_TOKEN=super-secret',level:'critical',message:'sensitive'});
    for(let i=0;i<60;i++)report.checks.push({
      code:'CHK_'+String(i).padStart(3,'0'),level:'warning',message:'sensitive'
    });
    const output=interpretCanvasDiagnosis(report);
    expect(output.relevantCodes).toHaveLength(30);
    expect(visible(output)).not.toContain('super-secret');
    expect(output.summaryLines.find(x=>x.startsWith('Códigos relevantes:'))).toContain('más');
  });
});
