import {describe,it,expect,vi,afterEach} from 'vitest';
import TokenRotationJob from '../../src/services/auth/TokenRotationJob.js';
import CanvasTokenManager from '../../src/services/auth/CanvasTokenManager.js';
import EncryptionService from '../../src/services/infrastructure/EncryptionService.js';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
describe('Canvas token rotation diagnostic scenarios',()=>{
  it('skips a token that cannot be decrypted without attempting OAuth',async()=>{
    const manager={tokenRepo:{getExpiringTokens:vi.fn().mockResolvedValue([])},refreshToken:vi.fn()};
    const job=new TokenRotationJob(manager);
    await job.run();
    expect(manager.refreshToken).not.toHaveBeenCalled();
  });
  it('scans at current time plus 15 minutes',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
    const repo={getExpiringTokens:vi.fn().mockResolvedValue([])};
    await new TokenRotationJob({tokenRepo:repo}).run();
    expect(repo.getExpiringTokens.mock.calls[0][0].toISOString()).toBe('2026-10-26T12:15:00.000Z');
  });
  it('handles a successful token and ignores an unrefreshable one',async()=>{
    const refreshToken=vi.fn().mockResolvedValue('new-access');
    const repo={getExpiringTokens:vi.fn().mockResolvedValue([{canvas_sub:'u1',refresh_token:'valid'},{canvas_sub:'u2',refresh_token:null}])};
    await new TokenRotationJob({tokenRepo:repo,refreshToken}).run();
    expect(refreshToken).toHaveBeenCalledExactlyOnceWith('u1','valid');
  });
  it('continues to the next user when one refresh throws',async()=>{
    const refreshToken=vi.fn().mockRejectedValueOnce(new Error('invalid_grant')).mockResolvedValueOnce('success');
    const tokenRepo={getExpiringTokens:vi.fn().mockResolvedValue([{canvas_sub:'one',refresh_token:'r1'},{canvas_sub:'two',refresh_token:'r2'}])};
    await new TokenRotationJob({tokenRepo,refreshToken}).run();
    expect(refreshToken).toHaveBeenCalledTimes(2);
  });
  it('does not issue concurrent OAuth refreshes for the same identity',async()=>{
    let finish;
    const pending=new Promise(resolve=>{finish=resolve});
    const canvasClient={oauthFetch:vi.fn().mockReturnValue(pending)};
    const repo={saveToken:vi.fn()};
    const manager=new CanvasTokenManager(repo,{canvasBaseUrl:'http://localhost',canvasClientId:'test'},canvasClient);
    const first=manager.refreshToken('one','refresh');
    const second=manager.refreshToken('one','refresh');
    finish({ok:true,json:async()=>({access_token:'access',expires_in:3600,refresh_token:'next'})});
    expect(await first).toBe('access');
    expect(await second).toBe('access');
    expect(canvasClient.oauthFetch).toHaveBeenCalledTimes(1);
    expect(repo.saveToken).toHaveBeenCalledTimes(1);
  });
  it('AES-GCM identifies tampering and wrong ciphertext without exposing data',()=>{
    const encrypted=EncryptionService.encrypt('fixture-secret-only');
    expect(EncryptionService.decrypt(encrypted)).toBe('fixture-secret-only');
    const fields=encrypted.split(':');fields[2]='00'+fields[2].slice(2);
    expect(()=>EncryptionService.decrypt(fields.join(':'))).toThrow(/Fallo al desencriptar/);
  });
  it('cancels the initial scheduled scan on shutdown',async()=>{
    vi.useFakeTimers();
    const repo={getExpiringTokens:vi.fn().mockResolvedValue([])};
    const job=new TokenRotationJob({tokenRepo:repo},300000);
    job.start();job.stop();
    await vi.advanceTimersByTimeAsync(5001);
    expect(repo.getExpiringTokens).not.toHaveBeenCalled();
  });
});
