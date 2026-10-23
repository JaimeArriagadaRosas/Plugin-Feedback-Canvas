import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
dotenv.config({path:path.join(root,'.env'),quiet:true});
process.env.STARTUP_MODE='3';
const users=JSON.parse(fs.readFileSync(path.join(root,'tmp/canvas_local_users.json'),'utf8')).usuarios;
const {default:Client}=await import('../../apps/server/src/services/infrastructure/CanvasClient.js');
const {default:Gateway}=await import('../../apps/server/src/adapters/CanvasLmsAdapter.js');
const client=new Client(process.env.CANVAS_BASE_URL||'https://localhost:8443');
const candidates=[];
for(const t of users.filter(u=>u.rol==='teacher')){
 const gateway=new Gateway(client,{getValidToken:async()=>t.token});
 try{
 const courses=await gateway.getCourses(t.email);
 console.log('TEACHER',t.email,'COURSES',courses.length);
 for(const c of courses){
 const tasks=await gateway.getAssignments(c.id,t.email);
 for(const a of tasks){
 const submissions=await gateway.getAssignmentSubmissions(c.id,a.id,t.email);
 const eligible=submissions.filter(s=>s.submitted_at&&!s.missing&&s.workflow_state!=='unsubmitted'&&(s.score??s.entered_score??s.unposted_score)==null);
 const items=eligible.map(s=>({student:s.user_id,kind:s.submission_type,bodyChars:String(s.body||'').length,files:(s.attachments||[]).map(f=>f.filename),answers:(s.submission_data||s.answers||[]).length||0}));
 candidates.push(...eligible.map(s=>({teacher:t.email,course:c.id,task:a.id,student:s.user_id,kind:s.submission_type,files:(s.attachments||[]).map(f=>f.filename)})));
 console.log('TASK',JSON.stringify({teacher:t.email,course:c.id,task:a.id,title:a.name,total:submissions.length,eligible:items}));
 }
 }
 }catch(e){console.log('TEACHER_ERROR',t.email,e.message)}
}
console.log('SUMMARY',JSON.stringify(candidates));
