import { run,requireSuccess } from '../runner.js';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
import { createSpinner } from 'nanospinner';
import { sameDockerPath } from '../inspection/DockerInspector.js';
import { removeContainerAndWait } from './DockerRemoval.js';

async function verifyContainer(item){
  const r=requireSuccess(await run('docker',['inspect',item.id]),'Reinspección de contenedor');
  const c=JSON.parse(r.stdout)[0];
  if(c.Name!==item.name || !sameDockerPath(c.Config?.Labels?.['com.docker.compose.project.working_dir'],item.dir))
    throw new Error('Container identity changed: '+item.name);
  return c.State?.Status || 'desconocido';
}
async function removeOne(item){
  const state = await verifyContainer(item);
  if(!await confirmAction({title:'Remove container '+item.name,
    detail:'Source: '+item.dir+'; service '+item.service+'. Only this container will be stopped and removed. Its database will not be deleted automatically.',risk:'high'}))
    throw new Error('Container cleanup declined: '+item.name);

  const spinner = createSpinner('Removing '+item.name+'; waiting for Docker...').start();
  const started = Date.now();
  let phase = 'Removal in progress';
  const ticker = setInterval(() => {
    const seconds = Math.floor((Date.now() - started) / 1000);
    spinner.update({text: phase+' de '+item.name+' ('+seconds+' s)'});
  }, 3000);
  try {
    const status = await removeContainerAndWait({
      id: item.id, alreadyRemoving: ['removing','dead'].includes(state),
      onProgress: ({state: current}) => { phase = 'Waiting for Docker (status: '+current+')'; }
    });
    clearInterval(ticker);
    spinner.success({text:'Container removed and verified: '+item.name});
    if(status.completedAfterError) boot.warn('Docker initially reported an error, but container removal was verified.');
  } catch (error) {
    clearInterval(ticker);
    spinner.error({text:'Failed to complete removal of '+item.name});
    throw error;
  } finally {
    clearInterval(ticker);
  }
}
async function removeVolume(v,source){
  const present=await run('docker',['volume','inspect',v.name]);
  if(!present.ok)return;
  const attached=requireSuccess(await run('docker',['ps','-aq','--filter','volume='+v.name]),'Referencias al volumen').stdout;
  if(attached)throw new Error('Volume still used by containers: '+v.name);
  if(!await confirmAction({title:'Delete persistent volume '+v.name,
    detail:'Source '+source+'; service '+v.service+', destination '+v.destination+'. Data will be PERMANENTLY LOST (including users and courses if this is the Canvas database).',risk:'high'}))
    throw new Error('Existing volume preserved; clean switch cancelled: '+v.name);
  requireSuccess(await run('docker',['volume','rm',v.name]),'Delete volume');
  boot.success('Volume data removed: '+v.name);
}
export async function prepareDocker(ctx){
  if(!ctx.docker.available)throw new Error('Docker unavailable for cleanup inspection');
  const containers=[
    ...ctx.docker.projects.flatMap(p=>p.containers),
    ...ctx.docker.foreign
  ];
  const volumes=new Map();
  for(const item of containers)for(const v of item.volumes||[])volumes.set(v.name,{v,origin:item.dir});
  for(const project of ctx.docker.projects)for(const v of project.volumes||[])volumes.set(v.name,{v,origin:project.dir});
  for(const item of containers)await removeOne(item);
  for(const {v,origin} of volumes.values())await removeVolume(v,origin);
}
