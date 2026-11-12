import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyCanvasLoginIncident, safeCanvasIncidentRecord, writeCanvasIncidentReport } from '../../src/local/CanvasLoginIncident.js';
import { observeCanvasLoginFailure } from '../../src/local/CanvasLoginResponseObserver.js';

const signature = '<h1>ActiveRecord::InvalidForeignKey in Login::CanvasController#create</h1>PG::ForeignKeyViolation: insert or update on table "terms_of_services" violates foreign key constraint "fk_rails_337ba633a9" Key (account_id)=(100000000000001) is not present in table "accounts".';
const other = '<h1>ActiveRecord::StatementInvalid</h1>';
const matrix = [
  { name: 'TOS FK global', input: signature, expected: 'CANVAS-DB-003' },
  { name: 'TOS FK local', input: signature.replace('100000000000001', '400'), expected: 'CANVAS-DB-003' },
  { name: 'TOS FK alternate case', input: signature.toUpperCase(), expected: 'CANVAS-DB-003' },
  { name: 'other Rails exception', input: other, expected: 'CANVAS-LOGIN-500' },
  { name: 'missing PostgreSQL', input: 'PG::ConnectionBad could not connect to server', expected: 'CANVAS-LOGIN-500' },
  { name: 'invalid credentials response', input: 'Please verify username and password', expected: 'CANVAS-LOGIN-500' },
  { name: 'HTML containing user data', input: signature + '<input name="password" value="sensitive">', expected: 'CANVAS-DB-003' }
];

describe('Canvas login incident classification and redaction', () => {
  for (const { name, input, expected } of matrix) {
    it(name, () => {
      const incident = classifyCanvasLoginIncident(input);
      expect(incident.code).toBe(expected);
      const serialized = JSON.stringify(safeCanvasIncidentRecord(incident));
      expect(serialized).not.toContain('100000000000001');
      expect(serialized).not.toContain('sensitive');
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('cookie');
    });
  }
  it('does not pretend that an unknown FK root cause is proven', () => {
    expect(safeCanvasIncidentRecord(classifyCanvasLoginIncident(signature)).confirmedRootCause).toBe(false);
  });
  it('writes a restricted incident JSON with no HTML content', () => {
    const directory=fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-incidents-'));
    try {
      const record=safeCanvasIncidentRecord(classifyCanvasLoginIncident(signature));
      const result=writeCanvasIncidentReport(record,{directory});
      expect(result).toContain('CANVAS-DB-003');
      expect(JSON.parse(fs.readFileSync(result,'utf8'))).toEqual(record);
      expect(fs.readFileSync(result,'utf8')).not.toContain('100000000000001');
      if(process.platform!=='win32')expect(fs.statSync(result).mode & 0o777).toBe(0o600);
    } finally { fs.rmSync(directory,{recursive:true,force:true}); }
  });
  it('does not break Canvas response if the report fails to write', async () => {
    const upstream=new PassThrough();
    upstream.statusCode=500;
    const logger={warn:vi.fn()};
    const output=new PassThrough();
    const chunks=[];
    output.on('data',chunk=>chunks.push(chunk));
    observeCanvasLoginFailure({method:'POST',url:'/login/canvas'},upstream,logger,{reportDirectory:'/dev/null/unwritable'});
    upstream.pipe(output);
    const finished=once(output,'end');
    upstream.end(signature);
    await finished;
    expect(Buffer.concat(chunks).toString()).toBe(signature);
    expect(logger.warn.mock.calls.flat().join(' ')).toContain('CANVAS-DB-003');
  });
});
