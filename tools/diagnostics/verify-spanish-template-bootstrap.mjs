// Real PostgreSQL validation isolated to TEMP tables on one connection.
// No permanent template or metadata rows are changed.
import dotenv from 'dotenv';
dotenv.config({quiet:true});
import db from '../../apps/server/src/data/db.js';
import TemplateRepository from '../../apps/server/src/data/TemplateRepository.js';
import TemplateManager from '../../apps/server/src/services/TemplateManager.js';

const pool=db.pool;
const client=await pool.connect();
const originalQuery=db.query;
const originalConnect=pool.connect;
const query=client.query.bind(client);
const results={};
try {
 await query(`CREATE TEMP TABLE Plantilla_Feedback (
   id BIGSERIAL PRIMARY KEY,
   nombre TEXT NOT NULL,
   contenido TEXT NOT NULL,
   profesor_id TEXT,
   deleted_at TIMESTAMPTZ,
   actualizado_en TIMESTAMPTZ DEFAULT NOW(),
   UNIQUE(nombre,profesor_id)
 )`);
 await query(`CREATE TEMP TABLE Profesor_Metadata (
   profesor_id TEXT PRIMARY KEY,
   has_seeded_templates BOOLEAN NOT NULL DEFAULT FALSE,
   actualizado_en TIMESTAMPTZ DEFAULT NOW()
 )`);
 // A shared database can contain English defaults without Spanish ones.
 await query("INSERT INTO Plantilla_Feedback(nombre,contenido,profesor_id) VALUES('Standard Class','{}',NULL)");
 db.query=async(...args)=>query(...args);
 pool.connect=async()=>({query,release(){}});
 const repo=new TemplateRepository();
 const manager=new TemplateManager(repo);
 const first=await manager.getTemplatesForProfesor('fixture-es');
 if(first.length!==3)throw Error('Spanish first bootstrap must clone exactly 3 templates, got '+first.length);
 const defaults=(await query("SELECT nombre,contenido FROM Plantilla_Feedback WHERE profesor_id IS NULL AND nombre!='Standard Class'")).rows;
 if(defaults.length!==3)throw Error('Expected exactly 3 Spanish global defaults');
 const names=['Clase Estándar','Feedback Detallado','Evaluación Cruzada'];
 if(defaults.some(row=>!names.includes(row.nombre) ||
   String(row.contenido).includes('{{calificacion}}') || String(row.contenido).includes('{{promedio_curso}}')))
   throw Error('Spanish seed contains unexpected names or academic variables');
 const second=await manager.getTemplatesForProfesor('fixture-es');
 if(second.length!==3)throw Error('Repeated bootstrap duplicated templates');
 await query("UPDATE Plantilla_Feedback SET deleted_at=NOW() WHERE profesor_id='fixture-es' AND nombre='Clase Estándar'");
 const afterDelete=await manager.getTemplatesForProfesor('fixture-es');
 if(afterDelete.length!==2)throw Error('An intentionally soft-deleted template was unexpectedly regenerated');
 const spanishCount=(await query("SELECT count(*)::int AS n FROM Plantilla_Feedback WHERE profesor_id='fixture-es'")).rows[0].n;
 if(spanishCount!==3)throw Error('Unexpected number of Spanish teacher template records');
 results.result='PASS';
 results.mode='POSTGRES_TEMP_TABLES';
 results.englishFixtureRetained=true;
 results.globalSpanishSeeds=defaults.length;
 results.initialTeacherClones=first.length;
 results.repeatedBootstrapClones=second.length;
 results.afterSoftDelete=afterDelete.length;
} finally {
 db.query=originalQuery;
 pool.connect=originalConnect;
 client.release();
 await pool.end();
}
console.log(JSON.stringify(results,null,2));
