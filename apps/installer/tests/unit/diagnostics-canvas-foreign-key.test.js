import { describe, it, expect } from 'vitest';
import { analyzeLogString } from '../../src/installation/utils/Diagnostics.js';

describe('Canvas: diagnóstico conservador de fallos reales', () => {
  it('reconoce la excepción y restricción exactas de términos de servicio', () => {
    const log = 'ActiveRecord::InvalidForeignKey in Login::CanvasController#create\\n' +
      'PG::ForeignKeyViolation: ERROR: insert or update on table "terms_of_services" violates foreign key constraint "fk_rails_337ba633a9"\\n' +
      'DETAIL: Key (account_id)=(100000000000001) is not present in table "accounts".';
    const result = analyzeLogString(log);
    expect(result.type).toBe('CANVAS_TERMS_FOREIGN_KEY');
    expect(result.diagnosis).toContain('does NOT prove');
    expect(result.solution).toContain('global and local IDs');
  });
  it('identifica la colisión real de PostgreSQL al instalar desde Ubuntu', () => {
    const log = 'Error response from daemon: failed to set up container networking: Bind for 127.0.0.1:5432 failed: port is already allocated';
    const result = analyzeLogString(log);
    expect(result.type).toBe('HOST_PORT_OCCUPIED');
    expect(result.details).toBe('5432');
    expect(result.solution).toContain('Do not delete databases');
  });
  it('no atribuye a una base de datos sucia un error desconocido', () => {
    const result = analyzeLogString('Fallo no reconocido de un servicio externo');
    expect(result.type).toBe('UNKNOWN');
  });
});
