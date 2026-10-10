import { run,requireSuccess } from '../runner.js';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
async function verifyContainer(item){
  const r=requireSuccess(await run('docker',['inspect',item.id]),'Reinspección de contenedor');
  const c=JSON.parse(r.stdout)[0];
  if(c.Name!==item.name || c.Config?.Labels?.['com.docker.compose.project.working_dir']!==item.dir)
    throw new Error('Cambió la identidad del contenedor: '+item.name);
}
async function removeOne(item){
  await verifyContainer(item);
  if(!await confirmAction({title:'Retirar contenedor '+item.name,
    detail:'Procedencia: '+item.dir+'; servicio '+item.service+'. Se detendrá y eliminará únicamente este contenedor, sin borrar su base de datos automáticamente.',risk:'high'}))
    throw new Error('Limpieza del contenedor rechazada: '+item.name);
  requireSuccess(await run('docker',['rm','-f',item.id],{timeout:90000}),'Retirar contenedor');
  boot.success('Contenedor retirado: '+item.name);
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
  for(const item of containers)await removeOne(item);
  for(const {v,origin} of volumes.values())await removeVolume(v,origin);
}
