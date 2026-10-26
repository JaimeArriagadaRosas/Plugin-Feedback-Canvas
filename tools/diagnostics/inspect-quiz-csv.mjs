import fs from 'node:fs';
import {parseString} from '@fast-csv/parse';
const accounts=JSON.parse(fs.readFileSync('tmp/canvas_local_users.json','utf8')).usuarios;
const token=accounts.find(u=>u.rol==='teacher')?.token;
if(!token)throw Error('No local teacher token');
const base='http://127.0.0.1:8080';
async function api(url){const response=await fetch(base+url,{headers:{Authorization:'Bearer '+token}});if(!response.ok)throw Error('Canvas API HTTP '+response.status);return response.json();}
const reports=await api('/api/v1/courses/1/quizzes/6/reports');
const r=reports.filter(r=>r.report_type==='student_analysis'&&r.file?.id).sort((a,b)=>b.id-a.id)[0];
if(!r?.file?.id)throw Error('No completed Student Analysis file');
process.env.STARTUP_MODE='3';
const {default:CanvasClient}=await import('../../apps/server/src/services/infrastructure/CanvasClient.js');
const {default:CanvasLmsAdapter}=await import('../../apps/server/src/adapters/CanvasLmsAdapter.js');
const client=new CanvasClient(process.env.CANVAS_BASE_URL||'https://localhost:8443');
const gateway=new CanvasLmsAdapter(client,{getValidToken:async()=>token});
const {buffer}=await gateway.downloadSubmissionAttachment({id:r.file.id,filename:r.file.filename},accounts.find(u=>u.rol==='teacher').email);
const csv=buffer.toString('utf8');
const lines=csv.split(/\r?\n/).filter(Boolean);
console.log(JSON.stringify({reportId:r.id,fileId:r.file.id,headers:lines[0]?.split(','),sampleStudentRow:lines.find(x=>x.includes('Anna Brown')||x.includes(',9,'))?.slice(0,1200),csvBytes:Buffer.byteLength(csv)}));
