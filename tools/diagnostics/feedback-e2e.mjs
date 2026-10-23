import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
dotenv.config({path:path.join(root,'.env'),quiet:true});
process.env.STARTUP_MODE='3';
const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')));
const action=args.mode||'preflight';
const started=Date.now();
function record(stage,details={}) {console.log(JSON.stringify({time:new Date().toISOString(),stage,...details}));}
record('BEGIN',{action});
if(!['preflight','generate'].includes(action))throw Error('mode must be preflight or generate');
if(action==='generate'&&args.confirm!=='ONE_REQUEST')throw Error('--confirm=ONE_REQUEST required');
const course=Number(args.course||1),assignment=Number(args.assignment||2),student=Number(args.student||8);
const localUsers=JSON.parse(fs.readFileSync(path.join(root,'tmp','canvas_local_users.json'),'utf8')).usuarios;
const localTeacher=localUsers.find(u=>u.email===(args.teacher||'profesor@canvas.local'));
const token=process.env.CANVAS_TEST_ACCESS_TOKEN||localTeacher?.token;
if(!token)throw Error('No local teacher token: run startup mode 3 before this test.');

const {default:CanvasClient}=await import('../../apps/server/src/services/infrastructure/CanvasClient.js');
const {default:CanvasLmsAdapter}=await import('../../apps/server/src/adapters/CanvasLmsAdapter.js');
const {default:UngradedFeedbackService}=await import('../../apps/server/src/services/feedback/UngradedFeedbackService.js');
const {default:FeedbackRepository}=await import('../../apps/server/src/data/FeedbackRepository.js');
const {default:TokenRepository}=await import('../../apps/server/src/data/TokenRepository.js');
const {default:ConfigRepository}=await import('../../apps/server/src/data/ConfigRepository.js');
const {default:IAConfigManager}=await import('../../apps/server/src/services/IAConfigManager.js');
const canvas=new CanvasClient(process.env.CANVAS_BASE_URL||'https://localhost:8443');
const gateway=new CanvasLmsAdapter(canvas,{getValidToken:async()=>token});
const teacherId=args.teacher||'profesor@canvas.local';
const fetchStart=Date.now();
const [submission,task,rubric]=await Promise.all([
 gateway.getSubmission(course,assignment,student,teacherId),
 gateway.getAssignment(course,assignment,teacherId),
 gateway.getRubric(course,assignment,teacherId)
]);
record('CANVAS_FETCH',{elapsedMs:Date.now()-fetchStart,course,assignment,student,
 name:task.name,status:submission.workflow_state,submitted:!!submission.submitted_at,
 score:submission.score,attachments:(submission.attachments||[]).map(f=>({id:f.id,name:f.filename}))});
if(!submission.submitted_at||submission.missing||submission.workflow_state==='unsubmitted')
 throw Error('SKIP: no submitted work');
if((submission.score??submission.entered_score??submission.unposted_score)!==null &&
 (submission.score??submission.entered_score??submission.unposted_score)!==undefined)
 throw Error('SKIP: already graded');
if(submission.submission_type==='online_quiz'&&!(submission.answers?.length||submission.submission_data?.length))
 throw Error('SKIP: quiz answers not available');
const repository=new FeedbackRepository();
const previous=await repository.findByStudent(String(student),String(course));
const existing=previous.filter(f=>String(f.tarea_id)===String(assignment));
record('EXISTING_FEEDBACK',{count:existing.length,states:existing.map(f=>f.estado)});
if(existing.some(f=>['ENVIADO','APROBADO'].includes(f.estado)))throw Error('SKIP: approved or sent feedback must not be overwritten');
const pending=existing.find(f=>['PENDIENTE','EDITADO',null,undefined].includes(f.estado));
const configuration=new IAConfigManager(new TokenRepository(),new ConfigRepository());
const service=new UngradedFeedbackService(gateway,repository,configuration);
const originalDownload=gateway.downloadSubmissionAttachment.bind(gateway);
gateway.downloadSubmissionAttachment=async(file,id)=>{
 const st=Date.now();
 const result=await originalDownload(file,id);
 record('DOWNLOAD',{file:file.filename,bytes:result.buffer.length,mime:result.mime,elapsedMs:Date.now()-st});
 return result;
};
const info={submission,assignment:task,rubric,student:{name:args.name||'Estudiante'}};
const processed=await service.processor.process(submission,teacherId);
record('CONTENT',{characters:processed.markdown.length,images:processed.parts.length,warnings:processed.warnings,
 sample:processed.markdown.slice(0,500)});
if(action==='preflight'){record('DONE',{geminiCalls:0,databaseWrites:0,elapsedMs:Date.now()-started});process.exit(0);}
const config=await configuration.getGlobalActiveConfig(true);
if(String(config.service).toLowerCase()!=='gemini')throw Error('Active AI provider is not Gemini');
record('GEMINI_START',{model:config.model,attempts:1});
const result=await service.generate({courseId:course,assignmentId:assignment,studentId:student,teacherId,pending,
 canvasData:info,metadata:{studentName:args.name||'Estudiante',assignmentName:task.name},
 singleAttempt:true});
record('GEMINI_DONE',{feedbackId:result.data.id,characters:result.data.content.length,
 feedback:result.data.content,elapsedMs:Date.now()-started,postedToCanvas:false,gradeChanged:false});
