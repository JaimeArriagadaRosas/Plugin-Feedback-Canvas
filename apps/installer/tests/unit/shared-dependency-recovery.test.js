import { describe, it, expect } from 'vitest';
import { SharedDependencyRecovery } from '../../src/recovery/SharedDependencyRecovery.js';

const fixtures = (states, changes = {}) => async (_command, args) => {
  const name = args[1];
  const item = states.find(s => s.name === name);
  if (!item) throw Object.assign(new Error('No such object'), {stderr:'No such object'});
  const db = name === 'feedback_plugin_db_local';
  return {stdout:JSON.stringify({
    Config:{Labels:{'com.docker.compose.project':'previous-checkout','com.docker.compose.service':item.service},
      Image: db?'postgres:15-alpine':'gotenberg/gotenberg:8',
      Env:db?['POSTGRES_USER=postgres','POSTGRES_DB=feedback_plugin_db','POSTGRES_PASSWORD=CHANGE_ME_db_password_strong']:[]},
    State:{Running:item.state==='healthy',Health:{Status:item.state}},
    Mounts: db?[{Type:'volume',Destination:'/var/lib/postgresql/data'}]:[],
    NetworkSettings:{Ports:db?{'5432/tcp':[{HostPort:'5432'}]}:{'3000/tcp':[{HostPort:'3001'}]}},
    ...changes
  })};
};
const db={name:'feedback_plugin_db_local',state:'healthy',service:'db'};
const gotenberg={name:'feedback_plugin_gotenberg_local',state:'healthy',service:'gotenberg'};
const run=async(items,changes={})=>new SharedDependencyRecovery({exec:fixtures(items,changes),environment:{}}).plan('/tmp');

describe('isolated startup dependency recovery scenarios',()=>{
  it('clean install: preserves normal startup with no containers',async()=>expect((await run([])).kind).toBe('normal'));
  it('second startup: reuses compatible healthy shared services',async()=>expect((await run([db,gotenberg])).kind).toBe('reuse'));
  it('missing companion: blocks partial services without removal',async()=>expect((await run([db])).kind).toBe('block'));
  it('stopped service: blocks unsafe recovery',async()=>expect((await run([{...db,state:'exited'},gotenberg])).kind).toBe('block'));
  it('wrong Compose service identity: blocks',async()=>expect((await run([{...db,service:'other'},gotenberg])).kind).toBe('block'));
  it('wrong image: blocks',async()=>expect((await run([db,gotenberg],{Config:{Image:'unexpected'}})).kind).toBe('block'));
  it('wrong exposed port: blocks',async()=>expect((await run([db,gotenberg],{NetworkSettings:{Ports:{}}})).kind).toBe('block'));
  it('missing database volume: blocks',async()=>expect((await run([db,gotenberg],{Mounts:[]})).kind).toBe('block'));
  it('all simulations are inspection-only',async()=>{
    const calls=[];
    const inspect=fixtures([db,gotenberg]);
    const service=new SharedDependencyRecovery({exec:async(cmd,args)=>{calls.push([cmd,args[0]]);return inspect(cmd,args)},environment:{}});
    await service.plan('/tmp');
    expect(calls).toEqual([['docker','inspect'],['docker','inspect']]);
  });
});
