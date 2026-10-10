import fs from 'node:fs';
import path from 'node:path';
import { run, requireSuccess } from '../runner.js';
const FIXED = ['feedback_plugin_db_local', 'feedback_plugin_gotenberg_local'];
const parse = r => JSON.parse(r.stdout)[0];
async function inspect(id) { return parse(requireSuccess(await run('docker',['inspect',id]),'Docker inspect')); }
async function mounts(c) {
  const volumes=[];
  for(const m of c.Mounts||[]) if(m.Type==='volume' && m.Name && !volumes.some(v=>v.name===m.Name))
    volumes.push({name:m.Name,destination:m.Destination,service:c.Config.Labels?.['com.docker.compose.service']||''});
  return volumes;
}
async function verifiedSibling(c, root, remote) {
  const labels=c.Config?.Labels||{};
  const dir=labels['com.docker.compose.project.working_dir'];
  const configs=(labels['com.docker.compose.project.config_files']||'').split(',');
  if (!dir || !['db','gotenberg'].includes(labels['com.docker.compose.service'])) return null;
  if (!configs.some(p=>path.basename(p)==='docker-compose.db.yml' && path.dirname(p)===dir)) return null;
  if (!fs.existsSync(path.join(dir,'docker-compose.db.yml'))) return null;
  const git=await run('git',['remote','get-url','origin'],{cwd:dir});
  if(!git.ok)return null;
  if(git.stdout===remote)return dir;
  // Algunos clones de vídeo usan un remoto local que apunta al repositorio original.
  const localUrl=git.stdout.replace(/^file:\/\//,'');
  if(!path.isAbsolute(localUrl))return null;
  const upstream=await run('git',['remote','get-url','origin'],{cwd:localUrl});
  const head=await run('git',['rev-parse','--show-toplevel'],{cwd:localUrl});
  return upstream.ok && upstream.stdout===remote && head.ok && path.resolve(head.stdout)===path.resolve(localUrl) ? dir : null;
}
export async function inspectDocker(root, canvas) {
  const info=await run('docker',['info','--format','{{json .}}'],{timeout:12000});
  if(!info.ok)return {available:false,error:info.stderr,projects:[],foreign:[]};
  const context=requireSuccess(await run('docker',['context','show']),'Docker context').stdout;
  const remote=requireSuccess(await run('git',['remote','get-url','origin'],{cwd:root}),'Origin Git').stdout;
  const projects=[],foreign=[];
  for(const [name,dir,file] of [['plugin',root,'docker-compose.db.yml'],['canvas',canvas,'docker-compose.yml']]){
    if(!fs.existsSync(path.join(dir,file)))continue;
    const cfg=requireSuccess(await run('docker',['compose','-f',file,'config','--format','json'],{cwd:dir}),'Compose '+name);
    const projectName=JSON.parse(cfg.stdout).name;
    if(!projectName)throw new Error('No se obtuvo nombre de proyecto Compose');
    const ids=requireSuccess(await run('docker',['ps','-aq','--filter','label=com.docker.compose.project='+projectName]),'Docker ps').stdout.split(/\s+/).filter(Boolean);
    const containers=[];
    for(const id of ids){
      const c=await inspect(id),labels=c.Config?.Labels||{};
      if(labels['com.docker.compose.project.working_dir']!==dir)continue;
      containers.push({id:c.Id,name:c.Name,dir,service:labels['com.docker.compose.service'],running:c.State.Running,volumes:await mounts(c)});
    }
    const volumeNames=requireSuccess(await run('docker',['volume','ls','-q','--filter','label=com.docker.compose.project='+projectName]),'Volúmenes del proyecto').stdout.split(/\s+/).filter(Boolean);
    const volumes=[];
    for(const name of volumeNames){
      const meta=JSON.parse(requireSuccess(await run('docker',['volume','inspect',name]),'Inspección de volumen').stdout)[0];
      if(meta.Labels?.['com.docker.compose.project']!==projectName)continue;
      if(containers.some(c=>c.volumes.some(v=>v.name===name)))continue;
      volumes.push({name,service:'sin contenedor',destination:'volumen residual'});
    }
    projects.push({name,dir,file,projectName,containers,volumes});
  }
  for(const name of FIXED){
    const r=await run('docker',['inspect','--type','container',name]);
    if(!r.ok)continue;
    const c=parse(r),dir=c.Config?.Labels?.['com.docker.compose.project.working_dir'];
    if(dir===root)continue;
    const sibling=await verifiedSibling(c,root,remote);
    if(!sibling)throw new Error('Nombre ocupado por contenedor sin pertenencia verificada: '+name+'. No se permite borrado automático.');
    foreign.push({id:c.Id,name:c.Name,dir:sibling,service:c.Config.Labels['com.docker.compose.service'],running:c.State.Running,volumes:await mounts(c)});
  }
  return {available:true,context,projects,foreign};
}
