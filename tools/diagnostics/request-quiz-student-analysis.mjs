import fs from 'node:fs';
const accounts=JSON.parse(fs.readFileSync('tmp/canvas_local_users.json','utf8')).usuarios;
const teacher=accounts.find(u=>u.rol==='teacher');
if(!teacher?.token)throw Error('Authorized English teacher profile is missing');
const endpoint='http://127.0.0.1:8080/api/v1/courses/1/quizzes/1/reports';
const check=!process.argv.includes('--create-report');
const target=process.argv.includes('--progress')?'http://127.0.0.1:8080/api/v1/progress/1':endpoint;
const response=await fetch(target,{method:check?'GET':'POST',headers:{Authorization:'Bearer '+teacher.token,'Content-Type':'application/json'},...(check?{}:{body:JSON.stringify({quiz_report:{report_type:'student_analysis'}})}),signal:AbortSignal.timeout(15000)});
const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw.slice(0,250)}}
console.log(JSON.stringify({status:response.status,reports:Array.isArray(data)?data.map(r=>({id:r.id,reportType:r.report_type,progressUrl:r.progress_url,fileId:r.file?.id??null,workflowState:r.workflow_state??null})):undefined,reportId:data.id??null,reportType:data.report_type??null,progressUrl:data.progress_url??null,workflowState:data.workflow_state??null,message:data.message??data.errors??null,progressState:data.workflow_state??null,percent:data.completion??null}));
if(!response.ok)process.exitCode=2;
