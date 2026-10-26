import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({path:path.resolve('.env'),quiet:true});
const { default: FeedbackRepository } = await import('../../apps/server/src/data/FeedbackRepository.js');
const repository = new FeedbackRepository();
const cases=[
  {course:1,assignment:2,student:6,recipient:'John Smith'},
  {course:1,assignment:3,student:7,recipient:'Mary Johnson'},
  {course:3,assignment:8,student:10,recipient:'Charles Davis'}
];
let passed=0;
for(const entry of cases) {
  const records=(await repository.findByStudent(String(entry.student),String(entry.course)))
    .filter(row=>String(row.tarea_id)===String(entry.assignment));
  if(records.length!==1)throw Error('Expected exactly one feedback for '+JSON.stringify(entry));
  const row=records[0];
  const state=row.estado ?? 'PENDIENTE';
  if(!['PENDIENTE','EDITADO'].includes(state))throw Error('Unexpected feedback state '+state);
  if(row.nota_canvas!==null||row.nota_chile!==null||row.aprobado!==null)
    throw Error('Unexpected grade saved for student '+entry.student);
  if(row.nombre_estudiante!==entry.recipient)throw Error('Wrong feedback recipient for student '+entry.student);
  if(String(row.contenido_generado||'').length<200)throw Error('Empty feedback for student '+entry.student);
  if(/\b(Estimado|Estimada|fortalezas|calificación|retroalimentación)\b/i.test(row.contenido_generado))
    throw Error('Spanish response marker detected for '+entry.student);
  console.log(JSON.stringify({case:entry.assignment+'/'+entry.student,id:row.id,state,recipient:row.nombre_estudiante,chars:row.contenido_generado.length,grade:null,result:'PASS'}));
  passed++;
}
console.log(JSON.stringify({verification:'ENGLISH_DRAFTS',passed}));
process.exit(0);
