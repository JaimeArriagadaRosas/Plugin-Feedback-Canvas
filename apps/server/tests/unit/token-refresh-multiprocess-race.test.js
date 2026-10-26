import {describe,it,expect,vi} from 'vitest';
import CanvasTokenManager from '../../src/services/auth/CanvasTokenManager.js';

describe('advanced OAuth concurrency diagnostic, isolated clients',()=>{
 it('two independent managers can both refresh the same identity: distributed coordination is still needed',async()=>{
   const client={oauthFetch:vi.fn().mockResolvedValue({ok:true,json:async()=>({access_token:'new',refresh_token:'next',expires_in:3600})})};
   const repo={saveToken:vi.fn().mockResolvedValue()};
   const env={canvasBaseUrl:'http://test',canvasClientId:'client'};
   const a=new CanvasTokenManager(repo,env,client),b=new CanvasTokenManager(repo,env,client);
   await Promise.all([a.refreshToken('user','old'),b.refreshToken('user','old')]);
   expect(client.oauthFetch).toHaveBeenCalledTimes(2);
   expect(repo.saveToken).toHaveBeenCalledTimes(2);
 });
 it('a late refresh can re-create credentials after an independent disconnect: conditional persistence is required',async()=>{
   let release;
   const gate=new Promise(resolve=>{release=resolve});
   const client={oauthFetch:vi.fn().mockReturnValue(gate)};
   let tokenPresent=true;
   const repo={saveToken:vi.fn(async()=>{tokenPresent=true}),deleteToken:vi.fn(async()=>{tokenPresent=false})};
   const manager=new CanvasTokenManager(repo,{canvasBaseUrl:'http://test',canvasClientId:'client'},client);
   const pending=manager.refreshToken('user','old');
   await repo.deleteToken('user');
   expect(tokenPresent).toBe(false);
   release({ok:true,json:async()=>({access_token:'new',refresh_token:'next',expires_in:3600})});
   await pending;
   expect(tokenPresent).toBe(true);
 });
});
