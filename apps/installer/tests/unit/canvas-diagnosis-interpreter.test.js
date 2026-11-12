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
    expect(diagnosis.nextStep).toContain('normal application testing');
    expect(diagnosis.explanation).toMatch(/does not guarantee/i);
    expect(visible(diagnosis)).toContain('Registered shards: 2 (associations not verified)');
    expect(visible(diagnosis)).toContain('Canvas services: postgres=running; web=running; redis=running');
  });

  it('2: servicios detenidos solo sugiere opción 3 para Canvas local administrado', () => {
    const check = basic(['DOCKER_POSTGRES_STOPPED'],{status:'incomplete'});
    const diagnosis=interpretCanvasDiagnosis(check);
    expect(diagnosis.primaryCode).toBe('DOCKER_POSTGRES_STOPPED');
    expect(diagnosis.nextStep).toContain('option 3');
    expect(diagnosis.nextStep).toContain('external Canvas');
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
    expect(diagnosis.explanation).toContain('alone does not establish');
    expect(diagnosis.nextStep).toContain('alone cannot repair');
    expect(visible(diagnosis)).toContain('reference not found in the local table');
    expect(visible(diagnosis)).toContain('detected in the recent sample');
  });

  it.each([
    ['CANVAS-DB-HISTORY-UNKNOWN', 'Canvas migrations', 'Do not force migrations'],
    ['CANVAS-DB-SCHEMA-001','Database schema','Avoid reinstalls'],
    ['CANVAS_ROOT_ACCOUNT','Institutional accounts','Review institutional configuration'],
    ['CANVAS_ORPHAN_TERMS','Referential integrity','Do not delete records'],
    ['CANVAS_FOREIGN_KEYS','Database constraints','migration history'],
    ['CANVAS-DB-HISTORY-PENDING','Canvas migrations','backup'],
    ['CANVAS-REDIS-001','Canvas Redis','Do not automatically restart Redis'],
    ['CANVAS_SHARDS','Canvas shards','Switchman/Canvas'],
    ['CANVAS-DB-SCHEMA-002','Migration history','Do not assume compatibility']
  ])('asigna guía específica a %s', (code, component, nextStep) => {
    const output=interpretCanvasDiagnosis(basic([code],{status:'warning'}));
    expect(output.primaryCode).toBe(code);
    expect(output.component).toBe(component);
    expect(output.nextStep).toContain(nextStep);
  });

  it('señala cambios locales sin exponer rutas ni contenido de archivos', () => {
    const diagnosis=interpretCanvasDiagnosis(basic([], { pluginTrackedChanges:true }));
    expect(visible(diagnosis)).toContain('Uncommitted local changes (tracked files): yes');
    expect(diagnosis.limitations.join(' ')).toContain('before git pull');
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
    expect(out).toContain('Canvas revision: not checked');
  });

  it('no eleva automáticamente un diagnóstico incompleto a saludable', () => {
    const report=basic([], { status:'incomplete', database:null, recentLoginFailure:null });
    const diagnosis=interpretCanvasDiagnosis(report);
    expect(diagnosis.status).toBe('incomplete');
    expect(diagnosis.primaryCode).toBe('CANVAS-CHECKS-INCOMPLETE');
    expect(visible(diagnosis)).toContain('not checked');
    expect(diagnosis.limitations).toContain('Some checks were incomplete; missing data do not imply a healthy result.');
  });

  it('prioriza fallos de propiedad sobre errores generales', () => {
    const report=basic(['CANVAS_LAST_FK_ERROR','DOCKER_POSTGRES_IDENTITY'],{status:'critical'});
    const diagnosis=interpretCanvasDiagnosis(report);
    expect(diagnosis.primaryCode).toBe('DOCKER_POSTGRES_IDENTITY');
    expect(diagnosis.nextStep).toContain('Do not automatically start, delete or recreate');
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
    expect(output.summaryLines.find(x=>x.startsWith('Relevant codes:'))).toContain('more');
  });
});
