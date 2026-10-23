import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
dotenv.config({path:path.join(root,'.env'),quiet:true});process.env.STARTUP_MODE='3';
const users=JSON.parse(fs.readFileSync(path.join(root,'tmp/canvas_local_users.json'),'utf8')).usuarios;
const teacher=users.find(u=>u.email==='profesor@canvas.local');
const {default:CanvasClient}=await import('../../apps/server/src/services/infrastructure/CanvasClient.js');
const {default:CanvasLmsAdapter}=await import('../../apps/server/src/adapters/CanvasLmsAdapter.js');
const gateway=new CanvasLmsAdapter(new CanvasClient(process.env.CANVAS_BASE_URL||'https://localhost:8443'),{getValidToken:async()=>teacher.token});
const quiz=await gateway.getAssignment(1,1,teacher.email);
const questions=await gateway.getQuizQuestions(1,1,teacher.email);
const sub=await gateway.getSubmission(1,1,6,teacher.email);
const quizzes=await gateway._fetchAllWithToken('/courses/1/quizzes',teacher.email);
const target=quizzes.find(q=>String(q.assignment_id)==='1');
if(target){
 for(const endpoint of [
  '/courses/1/quizzes/'+target.id+'/submissions?include[]=submission',
  '/courses/1/quizzes/'+target.id+'/submissions?include[]=submission_history'
 ]){
  try {
   const rows=await gateway._fetchWithToken(endpoint,teacher.email);
   const arr=rows.quiz_submissions||rows;
   console.log('QUIZ_ENDPOINT',endpoint,'COUNT',Array.isArray(arr)?arr.length:0,
    'MATCHES',(Array.isArray(arr)?arr:[]).filter(x=>String(x.user_id)==='6').map(x=>({id:x.id,attempt:x.attempt,keys:Object.keys(x),answerCount:x.submission_data?.length||0})));
  }catch(e){console.log('QUIZ_ENDPOINT_ERROR',e.message)}
 }
}
console.log(JSON.stringify({assignment:quiz.name,questionCount:questions.length,submissionType:sub.submission_type,score:sub.score,workflow:sub.workflow_state,submitted:!!sub.submitted_at,hasAnswers:Array.isArray(sub.submission_data)&&sub.submission_data.length>0,keys:Object.keys(sub).filter(k=>k.includes('answer')||k.includes('submission_data'))}));
