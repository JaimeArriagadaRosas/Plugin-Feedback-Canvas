import fs from 'node:fs';
const accounts=JSON.parse(fs.readFileSync('tmp/canvas_local_users.json','utf8')).usuarios;
const teacher=accounts.find(u=>u.rol==='teacher');
if(!teacher?.token)throw Error('Authorized local teacher profile is missing');
const options=Object.fromEntries(process.argv.slice(2).filter(v=>v.startsWith('--')&&v.includes('=')).map(v=>v.slice(2).split('=')));
const course=Number(options.course||1),quiz=Number(options.quiz||6),progress=options.progress?Number(options.progress):null;
if (![course,quiz,...(progress==null?[]:[progress])].every(v=>Number.isSafeInteger(v)&&v>0))throw Error('Course, quiz and progress IDs must be positive integers');
const endpoint='http://127.0.0.1:8080/api/v1/courses/'+course+'/quizzes/'+quiz+'/reports';
const check=!process.argv.includes('--create-report');
const target=progress?'http://127.0.0.1:8080/api/v1/progress/'+progress:endpoint;
const response=await fetch(target,{method:check?'GET':'POST',headers:{Authorization:'Bearer '+teacher.token,'Content-Type':'application/json'},...(check?{}:{body:JSON.stringify({quiz_report:{report_type:'student_analysis',includes_all_versions:process.argv.includes('--include-all-versions')}})}),signal:AbortSignal.timeout(15000)});
const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw.slice(0,250)}}
console.log(JSON.stringify({status:response.status,reports:Array.isArray(data)?data.map(r=>({id:r.id,reportType:r.report_type,progressUrl:r.progress_url,fileId:r.file?.id??null})):undefined,reportId:data.id??null,reportType:data.report_type??null,progressUrl:data.progress_url??null,workflowState:data.workflow_state??null,message:data.message??data.errors??null}));
if(!response.ok)process.exitCode=2;
