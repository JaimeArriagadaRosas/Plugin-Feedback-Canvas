import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({quiet:true});
const connection=process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:
  {host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,
   database:process.env.DB_NAME,port:Number(process.env.DB_PORT||5432)};
const pool=new pg.Pool(connection);
try {
 const names=['Clase Estándar','Feedback Detallado','Evaluación Cruzada'];
 const {rows}=await pool.query(
  'SELECT id, nombre, profesor_id, contenido, deleted_at FROM Plantilla_Feedback WHERE nombre=ANY($1::text[]) ORDER BY nombre,id',
  [names]);
 const analysis=rows.map(row=>({
  id:row.id,name:row.nombre,ownership:row.profesor_id==null?'global':'teacher',
  deleted:!!row.deleted_at,
  hasGrade:String(row.contenido).includes('{{calificacion}}'),
  hasCourseAverage:String(row.contenido).includes('{{promedio_curso}}'),
  contentLength:String(row.contenido).length
 }));
 console.log(JSON.stringify({count:rows.length,rows:analysis},null,2));
} finally {await pool.end();}
