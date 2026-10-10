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
    throw new Error('Cambió la identidad del contenedor: '+item.name);
  return c.State?.Status || 'desconocido';
}
async function removeOne(item){
  const state = await verifyContainer(item);
  if(!await confirmAction({title:'Retirar contenedor '+item.name,
    detail:'Procedencia: '+item.dir+'; servicio '+item.service+'. Se detendrá y eliminará únicamente este contenedor, sin borrar su base de datos automáticamente.',risk:'high'}))
    throw new Error('Limpieza del contenedor rechazada: '+item.name);

  const spinner = createSpinner('Eliminando '+item.name+'; esperando a Docker...').start();
  const started = Date.now();
  let phase = 'Eliminación en curso';
  const ticker = setInterval(() => {
    const seconds = Math.floor((Date.now() - started) / 1000);
    spinner.update({text: phase+' de '+item.name+' ('+seconds+' s)'});
  }, 3000);
  try {
    const status = await removeContainerAndWait({
      id: item.id, alreadyRemoving: ['removing','dead'].includes(state),
      onProgress: ({state: current}) => { phase = 'Esperando a Docker (estado: '+current+')'; }
    });
    clearInterval(ticker);
    spinner.success({text:'Contenedor eliminado y verificado: '+item.name});
    if(status.completedAfterError) boot.warn('Docker devolvió un error inicial, pero se confirmó la eliminación del contenedor.');
  } catch (error) {
    clearInterval(ticker);
    spinner.error({text:'No se completó la eliminación de '+item.name});
    throw error;
  } finally {
    clearInterval(ticker);
  }
}
async function removeVolume(v,source){
  const present=await run('docker',['volume','inspect',v.name]);
  if(!present.ok)return;
  const attached=requireSuccess(await run('docker',['ps','-aq','--filter','volume='+v.name]),'Referencias al volumen').stdout;
  if(attached)throw new Error('Volumen aún utilizado por contenedores: '+v.name);
  if(!await confirmAction({title:'Eliminar volumen persistente '+v.name,
    detail:'Origen '+source+'; servicio '+v.service+', destino '+v.destination+'. Los datos se PERDERÁN definitivamente (usuarios y cursos si es la base de Canvas).',risk:'high'}))
    throw new Error('Volumen anterior conservado; cambio limpio cancelado: '+v.name);
  requireSuccess(await run('docker',['volume','rm',v.name]),'Eliminar volumen');
  boot.success('Datos del volumen retirados: '+v.name);
}
export async function prepareDocker(ctx){
  if(!ctx.docker.available)throw new Error('Docker no disponible para inspección de limpieza');
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
