import {describe,it,expect,vi,afterEach} from 'vitest';
import CanvasTokenManager from '../../src/services/auth/CanvasTokenManager.js';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
const setup=(response)=> {
 const repo={deleteToken:vi.fn(),saveToken:vi.fn(),getToken:vi.fn()};
 const canvas={oauthFetch:vi.fn().mockResolvedValue(response)};
 return {repo,canvas,manager:new CanvasTokenManager(repo,{canvasBaseUrl:'http://canvas',canvasClientId:'client'},canvas)};
};
describe('OAuth refresh failure handling (isolated mocked Canvas)',()=>{
 it.each([400,401])('revoked credentials HTTP %s require OAuth and invalidate just that identity',async(status)=>{
  const {manager,repo,canvas}=setup({ok:false,status});
  await expect(manager.refreshToken('user-1','fixture-token')).rejects.toThrow(/Invalid grant/);
  expect(repo.deleteToken).toHaveBeenCalledExactlyOnceWith('user-1');
  expect(repo.saveToken).not.toHaveBeenCalled();
  expect(canvas.oauthFetch).toHaveBeenCalledTimes(1);
 });
 it('missing refresh token fails before contacting Canvas',async()=>{
  const {manager,repo,canvas}=setup({});
  repo.getToken.mockResolvedValue({accessToken:'access',expiresAt:new Date(0),refreshToken:null});
  await expect(manager.getValidToken('user-2')).rejects.toThrow(/Expired token/);
  expect(canvas.oauthFetch).not.toHaveBeenCalled();
 });
 it('unexpired access token is reused without OAuth call',async()=>{
  const {manager,repo,canvas}=setup({});
  repo.getToken.mockResolvedValue({accessToken:'valid',refreshToken:'r',expiresAt:new Date(Date.now()+60*60000)});
  await expect(manager.getValidToken('user-3')).resolves.toBe('valid');
  expect(canvas.oauthFetch).not.toHaveBeenCalled();
 });
 it('a transient failure retries and persists only the successful result',async()=>{
  vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);
  const {manager,repo,canvas}=setup({ok:false,status:503});
  canvas.oauthFetch.mockResolvedValueOnce({ok:false,status:503})
    .mockResolvedValueOnce({ok:true,json:async()=>({access_token:'fresh',expires_in:3600,refresh_token:'next'})});
  const refresh=manager.refreshToken('user-4','r');
  const assertion=expect(refresh).resolves.toBe('fresh');
  await vi.advanceTimersByTimeAsync(3000);
  await assertion;
  expect(canvas.oauthFetch).toHaveBeenCalledTimes(2);
  expect(repo.deleteToken).not.toHaveBeenCalled();
  expect(repo.saveToken).toHaveBeenCalledTimes(1);
 });
});
