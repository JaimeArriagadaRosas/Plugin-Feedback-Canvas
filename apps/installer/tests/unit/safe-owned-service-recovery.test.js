import { describe, expect, it } from 'vitest';
import { SharedDependencyRecovery } from '../../src/recovery/SharedDependencyRecovery.js';

const env = {
  PLUGIN_DB_CONTAINER_NAME: 'qa_feedback_db_20261110',
  PLUGIN_GOTENBERG_CONTAINER_NAME: 'qa_feedback_gotenberg_20261110',
  COMPOSE_PROJECT_NAME: 'qa-feedback-20261110',
  PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY: 'true',
  DB_PORT: '55432', GOTENBERG_PORT: '53001'
};

function makeRuntime({ stateDb = 'stopped', stateG = 'healthy', project = env.COMPOSE_PROJECT_NAME,
  portDb = '55432', imageDb = 'postgres:15-alpine', brokenPassword = false, onStart = null } = {}) {
  const calls = [];
  let dbState=stateDb;
  const read = name => {
    const db=name===env.PLUGIN_DB_CONTAINER_NAME;
    const state=db?dbState:stateG;
    return {
      Config: {
        Labels: { 'com.docker.compose.project':project, 'com.docker.compose.service':db?'db':'gotenberg' },
        Image: db?imageDb:'gotenberg/gotenberg:8',
        Env:db?['POSTGRES_USER=postgres','POSTGRES_DB=feedback_plugin_db',
          'POSTGRES_PASSWORD='+ (brokenPassword?'wrong':'CHANGE_ME_db_password_strong')]:[]
      },
      State: {Running:state!=='stopped',Health:{Status:state}},
      Mounts:db?[{Type:'volume',Destination:'/var/lib/postgresql/data'}]:[],
      HostConfig:{PortBindings:db?{'5432/tcp':[{HostPort:portDb}]}:{'3000/tcp':[{HostPort:'53001'}]}},
      NetworkSettings:{Ports:state==='stopped'?{}:(db?{'5432/tcp':[{HostPort:portDb}]}:{'3000/tcp':[{HostPort:'53001'}]})}
    };
  };
  const exec=async (binary,args)=>{
    calls.push([binary,...args]);
    if(args[0]==='inspect')return {stdout:JSON.stringify(read(args[1]))};
    if(args[0]==='start') {
      if(onStart)await onStart();
      dbState='healthy';
      return {stdout:args[1]};
    }
    throw Error('Unexpected Docker operation');
  };
  return {exec,calls,setDb:value=>{dbState=value;}};
}

const attempt = async (runtime, environment=env) =>
  new SharedDependencyRecovery({exec:runtime.exec,environment})
    .recoverOwnedStopped('/tmp', {maxPolls:2,intervalMs:0,wait:async()=>{}});

describe('Safe recovery: exact identity, ownership and bounded operations',()=>{
  it('starts one stopped own service, then validates health', async()=>{
    const rt=makeRuntime();
    const result=await attempt(rt);
    expect(result.kind).toBe('reuse');
    expect(result.recovered).toEqual([env.PLUGIN_DB_CONTAINER_NAME]);
    expect(rt.calls.filter(c=>c[1]==='start')).toEqual([['docker','start',env.PLUGIN_DB_CONTAINER_NAME]]);
    expect(rt.calls.some(c=>['rm','stop','restart','down','volume'].includes(c[1]))).toBe(false);
  });
  it('does nothing without explicit opt-in', async()=>{
    const rt=makeRuntime();expect((await attempt(rt,{...env,PLUGIN_ALLOW_OWNED_SERVICE_RECOVERY:'false'})).kind).toBe('block');
    expect(rt.calls.some(c=>c[1]==='start')).toBe(false);
  });
  it('does nothing without known Compose project', async()=>{
    const rt=makeRuntime();expect((await attempt(rt,{...env,COMPOSE_PROJECT_NAME:''})).kind).toBe('block');
    expect(rt.calls.some(c=>c[1]==='start')).toBe(false);
  });
  it('rejects previous checkout ownership', async()=>{
    const rt=makeRuntime({project:'previous-checkout'});expect((await attempt(rt)).kind).toBe('block');
    expect(rt.calls.some(c=>c[1]==='start')).toBe(false);
  });
  it('rejects wrong PostgreSQL image', async()=>{
    const rt=makeRuntime({imageDb:'postgres:99'});expect((await attempt(rt)).kind).toBe('block');
    expect(rt.calls.some(c=>c[1]==='start')).toBe(false);
  });
  it('rejects port conflict', async()=>{
    const rt=makeRuntime({portDb:'5432'});expect((await attempt(rt)).kind).toBe('block');
    expect(rt.calls.some(c=>c[1]==='start')).toBe(false);
  });
  it('rejects mismatched credentials', async()=>{
    const rt=makeRuntime({brokenPassword:true});expect((await attempt(rt)).kind).toBe('block');
    expect(rt.calls.some(c=>c[1]==='start')).toBe(false);
  });
  it('never restarts an active but unhealthy service', async()=>{
    const rt=makeRuntime({stateDb:'unhealthy'});expect((await attempt(rt)).kind).toBe('block');
    expect(rt.calls.some(c=>c[1]==='start')).toBe(false);
  });
  it('never restarts healthy services', async()=>{
    const rt=makeRuntime({stateDb:'healthy'});const result=await attempt(rt);
    expect(result.kind).toBe('reuse');expect(result.recovered).toEqual([]);
    expect(rt.calls.some(c=>c[1]==='start')).toBe(false);
  });
  it('avoids time-of-check/time-of-use state changes',async()=>{
    const rt=makeRuntime();
    let inspectCount=0;
    const inspect=rt.exec;
    rt.exec=async(cmd,args)=>{
      if(args[0]==='inspect' && args[1]===env.PLUGIN_DB_CONTAINER_NAME && ++inspectCount===2)rt.setDb('healthy');
      return inspect(cmd,args);
    };
    expect((await attempt(rt)).kind).toBe('block');
    expect(rt.calls.some(c=>c[1]==='start')).toBe(false);
  });

  it('does not trust HostConfig when an active service publishes the wrong port', async()=>{
    const rt=makeRuntime({stateDb:'healthy'});
    const inspect=rt.exec;
    rt.exec=async(command,args)=>{
      const result=await inspect(command,args);
      if(args[0]==='inspect' && args[1]===env.PLUGIN_DB_CONTAINER_NAME) {
        const data=JSON.parse(result.stdout);
        data.NetworkSettings.Ports={};
        return {stdout:JSON.stringify(data)};
      }
      return result;
    };
    expect((await attempt(rt)).kind).toBe('block');
    expect(rt.calls.some(c=>c[1]==='start')).toBe(false);
  });
  it('does not retry a failing docker start',async()=>{
    const rt=makeRuntime();
    const original=rt.exec;
    rt.exec=async(command,args)=>{
      if(args[0]==='start') { rt.calls.push([command,...args]); throw Error('Docker unavailable'); }
      return original(command,args);
    };
    expect((await attempt(rt)).kind).toBe('block');
    expect(rt.calls.filter(c=>c[1]==='start')).toHaveLength(1);
  });
  it('blocks when a running service remains unhealthy',async()=>{
    const rt=makeRuntime({stateDb:'stopped',stateG:'unhealthy'});
    expect((await attempt(rt)).kind).toBe('block');
    expect(rt.calls.some(c=>c[1]==='start')).toBe(false);
  });
});
