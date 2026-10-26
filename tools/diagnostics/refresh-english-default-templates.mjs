import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({quiet:true});
const apply=process.argv.includes('--apply');
const sourcePath='apps/server/src/data/TemplateRepository.js';
const oldSource=execFileSync('git',['show','HEAD:'+sourcePath],{encoding:'utf8'});
const newSource=fs.readFileSync(sourcePath,'utf8');
function presets(source){
 const result=new Map();
 const regex=/\('((?:[^']|'')+)', '((?:[^']|'')+)', NULL\)/g;
 for(const match of source.matchAll(regex)){
  const name=match[1].replaceAll("''","'");
  if(!['Standard Class','Detailed Feedback','Peer Review'].includes(name))continue;
  result.set(name,JSON.parse(match[2].replaceAll("''","'")));
 }
 if(result.size!==3)throw Error('Exactly three defaults must be present');
 return result;
}
const previous=presets(oldSource), updated=presets(newSource);
const pool=new pg.Pool(process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:{host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:Number(process.env.DB_PORT||5432)});
const client=await pool.connect();
try{
 const rows=(await client.query('SELECT id,nombre,contenido,profesor_id,deleted_at FROM Plantilla_Feedback WHERE nombre=ANY($1::text[])',[['Standard Class','Detailed Feedback','Peer Review']])).rows;
 const globals=new Map(rows.filter(r=>r.profesor_id==null && !r.deleted_at).map(r=>[r.nombre,r]));
 const eligibleGlobal=(r)=>{
  if(!r || r.deleted_at || r.profesor_id!=null || !updated.has(r.nombre))return false;
  let parsed;try{parsed=typeof r.contenido==='string'?JSON.parse(r.contenido):r.contenido}catch{return false}
  if(!parsed || !['alto','medio','bajo'].every(k=>typeof parsed[k]==='string'&&parsed[k].includes('{{grade}}')))return false;
  return true;
 };
 const safe=rows.filter(r=>{
  if(r.deleted_at || !updated.has(r.nombre))return false;
  const global=globals.get(r.nombre);
  if(!eligibleGlobal(global))return false;
  if(r.profesor_id==null)return r.id===global.id;
  // Update only untouched clones: byte-for-byte same JSON as their global seed.
  return r.contenido===global.contenido;
 });
 console.log(JSON.stringify({mode:apply?'apply':'dry-run',total:rows.length,eligible:safe.length,protected:rows.length-safe.length,byTemplate:Object.fromEntries([...updated.keys()].map(k=>[k,safe.filter(r=>r.nombre===k).length])),observed:rows.map(r=>({id:r.id,name:r.nombre,owner:r.profesor_id==null?'global':'teacher',hasGrade:String(r.contenido).includes('{{grade}}'),hasAverage:String(r.contenido).includes('{{course_average}}'),length:String(r.contenido).length}))}));
 if(!apply)process.exitCode=0;
 else{
  const backup='logs/english-default-templates-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  fs.mkdirSync('logs',{recursive:true});
  fs.writeFileSync(backup,JSON.stringify(safe,null,2),{mode:0o600,flag:'wx'});
  await client.query('BEGIN');
  for(const row of safe){
   const update=await client.query('UPDATE Plantilla_Feedback SET contenido=$1, actualizado_en=NOW() WHERE id=$2 AND contenido=$3 RETURNING id',[JSON.stringify(updated.get(row.nombre)),row.id,row.contenido]);
   if(update.rowCount!==1)throw Error('Concurrent modification for template '+row.id);
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({updated:safe.length,backup}));
 }
}catch(error){
 try{await client.query('ROLLBACK')}catch{}
 console.error(error.message);
 process.exitCode=1;
}finally{client.release();await pool.end()}
