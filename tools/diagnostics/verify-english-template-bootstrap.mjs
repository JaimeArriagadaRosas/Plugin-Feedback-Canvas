import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({quiet:true});
const source=fs.readFileSync('apps/server/src/data/TemplateRepository.js','utf8');
const begin=source.indexOf('INSERT INTO Plantilla_Feedback (nombre, contenido, profesor_id) VALUES');
const end=source.indexOf(';',begin);
if(begin<0||end<0)throw Error('Seed statement unavailable');
const statement=source.slice(begin,end+1);
const config=process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:{host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:Number(process.env.DB_PORT||5432)};
const pool=new pg.Pool(config);
const client=await pool.connect();
try{
 await client.query('BEGIN');
 // TEMP table shadows real records only for this one transaction and connection.
 await client.query('CREATE TEMP TABLE Plantilla_Feedback (id BIGSERIAL,nombre TEXT,contenido TEXT,profesor_id TEXT) ON COMMIT DROP');
 await client.query(statement);
 const seeded=(await client.query('SELECT nombre,contenido FROM Plantilla_Feedback WHERE profesor_id IS NULL')).rows;
 if(seeded.length!==3)throw Error('Expected three default templates');
 for(const row of seeded){
  const value=JSON.parse(row.contenido);
  if(!['alto','medio','bajo'].every(k=>typeof value[k]==='string'))throw Error('Missing score-range content');
  if(JSON.stringify(value).match(/\{\{(?:grade|course_average)\}\}/))throw Error('Forbidden default academic variable');
 }
 await client.query("INSERT INTO Plantilla_Feedback (nombre,contenido,profesor_id) SELECT nombre,contenido,'isolated-fixture' FROM Plantilla_Feedback WHERE profesor_id IS NULL");
 const clones=(await client.query("SELECT contenido FROM Plantilla_Feedback WHERE profesor_id='isolated-fixture'")).rows;
 if(clones.length!==3)throw Error('Fresh teacher did not receive exactly three templates');
 if(clones.some(r=>r.contenido.includes('{{grade}}')||r.contenido.includes('{{course_average}}')))throw Error('Clone unexpectedly contains grade or average');
 console.log(JSON.stringify({result:'PASS',mode:'TEMP_TABLE_ROLLBACK',defaults:seeded.length,clones:clones.length,gradesInserted:0}));
}finally{
 try{await client.query('ROLLBACK')}finally{client.release();await pool.end()}
}
