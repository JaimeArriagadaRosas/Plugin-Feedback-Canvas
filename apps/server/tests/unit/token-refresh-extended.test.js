import {describe,it,expect,vi,afterEach} from 'vitest';
import CanvasTokenManager from '../../src/services/auth/CanvasTokenManager.js';
import TokenRotationJob from '../../src/services/auth/TokenRotationJob.js';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
const setup=()=>{
 const repo={getToken:vi.fn(),saveToken:vi.fn(),deleteToken:vi.fn(),getExpiringTokens:vi.fn()};
 const canvas={oauthFetch:vi.fn()};
 return {repo,canvas,manager:new CanvasTokenManager(repo,{canvasBaseUrl:'https://canvas.test',canvasClientId:'client'},canvas)};
};
describe('extended Canvas refresh error and lifecycle matrix',()=>{
 it.each([429,500,502,503,504])('HTTP %s exhaustion returns retryable failure without deleting tokens',async(status)=>{
  vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);
  const {repo,canvas,manager}=setup();
  canvas.oauthFetch.mockResolvedValue({ok:false,status});
  const refresh=manager.refreshToken('account-'+status,'fixture-refresh');
  const expectation=expect(refresh).rejects.toMatchObject({statusCode:503});
  await vi.advanceTimersByTimeAsync(10000);
  await expectation;
  expect(canvas.oauthFetch).toHaveBeenCalledTimes(3);
  expect(repo.deleteToken).not.toHaveBeenCalled();
  expect(repo.saveToken).not.toHaveBeenCalled();
 });
 it('network timeout exhaustion returns retryable failure and preserves credentials',async()=>{
  vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);
  const {repo,canvas,manager}=setup();
  canvas.oauthFetch.mockRejectedValue(new Error('ETIMEDOUT'));
  const refresh=manager.refreshToken('timeout','fixture-refresh');
  const expected=expect(refresh).rejects.toMatchObject({statusCode:503});
  await vi.advanceTimersByTimeAsync(10000);
  await expected;
  expect(canvas.oauthFetch).toHaveBeenCalledTimes(3);
  expect(repo.deleteToken).not.toHaveBeenCalled();
 });
 it('database write failure cannot return an unpersisted token as success',async()=>{
  vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);
  const {repo,canvas,manager}=setup();
  canvas.oauthFetch.mockResolvedValue({ok:true,json:async()=>({access_token:'new',refresh_token:'rotated',expires_in:3600})});
  repo.saveToken.mockRejectedValue(new Error('database offline'));
  const refresh=manager.refreshToken('db-error','fixture-refresh');
  const expected=expect(refresh).rejects.toMatchObject({statusCode:503});
  await vi.advanceTimersByTimeAsync(10000);
  await expected;
  expect(repo.saveToken).toHaveBeenCalledTimes(3);
  expect(repo.deleteToken).not.toHaveBeenCalled();
 });
 it('two users refresh independently without sharing their in-flight promise',async()=>{
  const {repo,canvas,manager}=setup();
  canvas.oauthFetch.mockImplementation(async(_path,options)=>{
    const token=JSON.parse(options.body).refresh_token;
    return {ok:true,json:async()=>({access_token:token+'-access',refresh_token:token+'-new',expires_in:3600})};
  });
  const values=await Promise.all([manager.refreshToken('one','alpha'),manager.refreshToken('two','beta')]);
  expect(values).toEqual(['alpha-access','beta-access']);
  expect(repo.saveToken).toHaveBeenCalledTimes(2);
 });
 it('duplicate start and stop cannot create new proactive requests',async()=>{
  vi.useFakeTimers();
  const repo={getExpiringTokens:vi.fn().mockResolvedValue([{canvas_sub:'one',refresh_token:'r'}])};
  const refreshToken=vi.fn().mockResolvedValue('new');
  const job=new TokenRotationJob({tokenRepo:repo,refreshToken},10000);
  job.start();job.start();
  await vi.advanceTimersByTimeAsync(5000);
  expect(refreshToken).toHaveBeenCalledTimes(1);
  await job.stop();
  await vi.advanceTimersByTimeAsync(60000);
  expect(refreshToken).toHaveBeenCalledTimes(1);
 });
});
