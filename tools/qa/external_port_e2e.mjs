import net from 'node:net';
import { spawn } from 'node:child_process';
import { resolveStartupPorts, isPortInUse } from '../../apps/installer/src/orchestration/portManager.js';

if (process.env.QA_ALLOW_DISPOSABLE_COMPAT_TESTS !== 'true' ||
    process.env.PLUGIN_TEST_MODE !== 'true' ||
    process.env.PLUGIN_QA_NO_BROWSER !== 'true') {
  throw new Error('QA guard: missing explicit triple opt-in');
}

const childScript = `
  const net=require('net');
  const server=net.createServer(socket => { socket.on('data',data=>socket.end('QA-PONG:'+data.toString())); });
  server.listen(0,'127.0.0.1',()=>{process.stdout.write('QA_LISTENER_PORT='+server.address().port+'\\n');});
  process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
`;
const child = spawn(process.execPath, ['-e', childScript], {
  stdio: ['ignore','pipe','pipe'],
  env: { PATH: process.env.PATH, HOME: process.env.HOME },
});
let port;
let partial='';
const timeout = setTimeout(() => child.kill('SIGTERM'), 15000);
try {
  port = await new Promise((resolve,reject) => {
    child.on('error',reject);
    child.on('exit',code=>reject(new Error('Listener exited too early: '+code)));
    child.stdout.on('data',chunk=>{
      partial += String(chunk);
      const match=partial.match(/QA_LISTENER_PORT=(\d+)/);
      if(match)resolve(Number(match[1]));
    });
  });
  if (!Number.isInteger(port) || !(await isPortInUse(port))) throw new Error('Port conflict not reproduced');
  let error = '';
  const asked = [];
  try {
    await resolveStartupPorts([port], {
      projectDir: process.cwd(),
      mode:'3',
      ask: async text=> { asked.push(text); return 'NO'; }
    });
  } catch (err) {
    error = err.message;
  }
  if (!error.includes(String(port))) throw new Error('Port conflict was not explained');
  if (!(await isPortInUse(port))) throw new Error('Foreign listener was unexpectedly closed');
  const response = await new Promise((resolve,reject)=>{
    const socket=net.connect({host:'127.0.0.1',port},()=>socket.write('PING'));
    let data='';
    socket.on('data',b=>{data+=String(b);});
    socket.on('end',()=>resolve(data));
    socket.on('error',reject);
  });
  if (response!=='QA-PONG:PING') throw new Error('Owner did not survive conflict preflight');
  console.log('QA_PORT_E2E='+JSON.stringify({
    scenario:'external_occupied_port_e2e',status:'PASS',portDetected:true,
    foreignProcessStillServing:true,noUnrequestedTermination:true,
    interactivePromptCount:asked.length
  }));
} finally {
  clearTimeout(timeout);
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),
    new Promise(resolve=>setTimeout(resolve,2500))]);
}
