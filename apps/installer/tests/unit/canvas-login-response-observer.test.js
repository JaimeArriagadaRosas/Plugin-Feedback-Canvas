import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { once } from 'node:events';
import { observeCanvasLoginFailure } from '../../src/local/CanvasLoginResponseObserver.js';

const signature = '<h1>ActiveRecord::InvalidForeignKey in Login::CanvasController#create</h1>PG::ForeignKeyViolation: ERROR: insert or update on table "terms_of_services" violates foreign key constraint "fk_rails_337ba633a9" DETAIL: Key (account_id)=(100000000000001) is not present in table "accounts".';
async function run(body, method='POST', url='/login/canvas', status=500) {
  const upstream = new PassThrough(); upstream.statusCode = status;
  const received = [];
  const downstream = new PassThrough();
  downstream.on('data', chunk => received.push(chunk));
  const warn = vi.fn();
  const observed = observeCanvasLoginFailure({method,url}, upstream, {warn});
  upstream.pipe(downstream);
  const done = once(downstream, 'end');
  upstream.end(body);
  await done;
  return {observed, warn, received:Buffer.concat(received).toString('utf8')};
}
describe('Canvas login failure observer: non-destructive diagnostics', () => {
  it('recognizes the exact Rails exception without altering HTTP bytes', async () => {
    const result = await run(signature);
    expect(result.observed).toBe(true);
    expect(result.warn).toHaveBeenCalledTimes(4);
    expect(result.received).toBe(signature);
    expect(result.warn.mock.calls.flat().join(' ')).not.toContain('100000000000001');
  });
  it('ignores successful logins and unrelated pages', async () => {
    const success = await run(signature,'POST','/login/canvas',302);
    const other = await run(signature,'POST','/courses',500);
    expect(success.observed).toBe(false);
    expect(other.observed).toBe(false);
    expect(success.warn).not.toHaveBeenCalled();
    expect(other.warn).not.toHaveBeenCalled();
    expect(success.received).toBe(signature);
  });
  it('does not diagnose a generic Rails error as missing accounts', async () => {
    const result=await run('<h1>ActiveRecord::StatementInvalid</h1>');
    expect(result.observed).toBe(true);
    expect(result.warn.mock.calls.flat().join(' ')).toContain('CANVAS-LOGIN-500');
  });
});
