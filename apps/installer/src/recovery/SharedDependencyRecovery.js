import { execa } from 'execa';

const DEPENDENCIES = [{service:'db',name:'feedback_plugin_db_local'},{service:'gotenberg',name:'feedback_plugin_gotenberg_local'}];

export class SharedDependencyRecovery {
  constructor({exec=execa}={}) { this.exec=exec; }
  async inspect(cwd) {
    const services=[];
    for(const entry of DEPENDENCIES) {
      let data;
      try {
        const response=await this.exec('docker',['inspect',entry.name,'--format','{{json .}}'],{cwd});
        data=JSON.parse(response.stdout);
      } catch(error) {
        if(/No such object|No such container/i.test(String(error.stderr||error.message))) {
          services.push({...entry,state:'absent'});
          continue;
        }
        throw new Error('Unable to inspect '+entry.name+': '+error.message);
      }
      const owner=data.Config?.Labels?.['com.docker.compose.project']||null;
      const service=data.Config?.Labels?.['com.docker.compose.service'];
      const health=data.State?.Health?.Status;
      const running=data.State?.Running===true;
      services.push({...entry,owner,state:!owner||service!==entry.service?'conflict':running&&health==='healthy'?'healthy':'unavailable'});
    }
    return services;
  }
  async plan(cwd) {
    const services=await this.inspect(cwd);
    if(services.some(s=>s.state==='conflict'))return {kind:'block',services,reason:'Unexpected container identity'};
    if(services.every(s=>s.state==='healthy'))return {kind:'reuse',services};
    if(services.every(s=>s.state==='absent'))return {kind:'normal',services};
    return {kind:'block',services,reason:'Partial or unhealthy shared dependencies require inspection'};
  }
}
