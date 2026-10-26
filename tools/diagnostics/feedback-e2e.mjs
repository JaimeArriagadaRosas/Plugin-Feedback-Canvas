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
if(!['preflight','generate','quiz-readonly'].includes(action))throw Error('mode must be preflight, generate, or quiz-readonly');
if(action==='generate'&&args.confirm!=='ONE_REQUEST')throw Error('--confirm=ONE_REQUEST required');
const course=Number(args.course||1),assignment=Number(args.assignment||2),student=Number(args.student||8);
const localUsers=JSON.parse(fs.readFileSync(path.join(root,'tmp','canvas_local_users.json'),'utf8')).usuarios;
const localTeacher=localUsers.find(u=>u.email===args.teacher) || (!args.teacher && localUsers.find(u=>u.rol==='teacher'));
if(!localTeacher && !process.env.CANVAS_TEST_ACCESS_TOKEN) throw Error('No authorized local teacher profile was found.');
let token=process.env.CANVAS_TEST_ACCESS_TOKEN||localTeacher?.token;
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
let teacherId=args.teacher||localTeacher?.email||'teacher@canvas.local';
let enrolled;
for (const candidate of (args.teacher ? [localTeacher] : localUsers.filter(u=>u.rol==='teacher'))) {
  if (!candidate?.token) continue;
  token = process.env.CANVAS_TEST_ACCESS_TOKEN || candidate.token;
  try { enrolled = await gateway.getStudents(course, candidate.email); teacherId=candidate.email; break; }
  catch (error) { if (error.statusCode!==403) throw error; }
}
if (!enrolled) throw Error('No authorized local teacher for course '+course);
const actualStudent=enrolled.find(s=>String(s.id)===String(student));
if(!actualStudent?.name) throw Error('SKIP: could not verify the student identity in Canvas');
if(args.name && args.name.toLocaleLowerCase('en').trim()!==actualStudent.name.toLocaleLowerCase('en').trim()) {
  record('STUDENT_NAME_MISMATCH',{provided:args.name,actual:actualStudent.name,studentId:student,providerRequests:0});
  if(action==='generate') throw Error('Provided identity does not match Canvas; feedback generation is blocked');
}
record('STUDENT_IDENTITY',{studentId:student,canvasName:actualStudent.name});
const fetchStart=Date.now();
const [submission,task,rubric]=await Promise.all([
 gateway.getSubmission(course,assignment,student,teacherId),
 gateway.getAssignment(course,assignment,teacherId),
 gateway.getRubric(course,assignment,teacherId)
]);
record('CANVAS_FETCH',{elapsedMs:Date.now()-fetchStart,course,assignment,student,
 name:task.name,status:submission.workflow_state,submitted:!!submission.submitted_at,
 score:submission.score,attachments:(submission.attachments||[]).map(f=>({id:f.id,name:f.filename}))});
if (action==='quiz-readonly') {
  if(submission.submission_type!=='online_quiz') throw Error('The selected submission is not a Classic Quiz');
  try {
    const answers=await gateway.getQuizAnswers(course,assignment,student,teacherId);
    record('QUIZ_READONLY_SUCCESS',{answers:answers.length,hasText:answers.some(a=>String(a.answer||'').trim()),geminiCalls:0,dbWrites:0});
  } catch(error) { record('QUIZ_READONLY_BLOCKED',{errorCode:error.errorCode||'QUIZ_ERROR',message:error.message,geminiCalls:0,dbWrites:0}); process.exitCode=2; }
  process.exit();
}
if(!submission.submitted_at||submission.missing||submission.workflow_state==='unsubmitted')
 throw Error('SKIP: no submitted work');
if(submission.workflow_state!=='pending_review' && (submission.score??submission.entered_score??submission.unposted_score)!==null &&
 (submission.score??submission.entered_score??submission.unposted_score)!==undefined)
 throw Error('SKIP: already graded');
if(submission.submission_type==='online_quiz'&&!(submission.answers?.length||submission.submission_data?.length)) {
 try {
   submission.answers=await gateway.getQuizAnswers(course,assignment,student,teacherId);
   submission.body=null;
   record('QUIZ_ANSWERS',{count:submission.answers.length,source:'canvas-rest'});
 } catch(error) {
   record('QUIZ_BLOCKED',{code:error.errorCode||'QUIZ_FETCH_FAILED',message:error.message,providerRequests:0});
   process.exit(2);
 }
}
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
const info={submission,assignment:task,rubric,student:{name:actualStudent.name}};
let processed;
try {
 processed=await service.processor.process(submission,teacherId);
} catch(error) {
 if(error.errorCode==='ATTACHMENT_UNREADABLE'||error.errorCode==='NO_READABLE_CONTENT'||error.errorCode==='NO_SUBMISSION') {
   record('EXPECTED_REJECTION',{errorCode:error.errorCode,status:error.statusCode||422,reason:error.message,providerRequests:0});
   process.exit(0);
 }
 throw error;
}
record('CONTENT',{characters:processed.markdown.length,images:processed.parts.length,warnings:processed.warnings,
 sample:processed.markdown.slice(0,500)});
if(action==='preflight'){record('DONE',{geminiCalls:0,databaseWrites:0,elapsedMs:Date.now()-started});process.exit(0);}
const config=await configuration.getGlobalActiveConfig(true);
if(String(config.service).toLowerCase()!=='gemini')throw Error('Active AI provider is not Gemini');
record('GEMINI_START',{model:config.model,attempts:1});
const result=await service.generate({courseId:course,assignmentId:assignment,studentId:student,teacherId,pending,
 canvasData:info,metadata:{studentName:actualStudent.name,assignmentName:task.name},
 singleAttempt:true,preparedContent:processed});
const afterSubmission=await gateway.getSubmission(course,assignment,student,teacherId);
const beforeScore=submission.score??submission.entered_score??submission.unposted_score??null;
const afterScore=afterSubmission.score??afterSubmission.entered_score??afterSubmission.unposted_score??null;
if(afterScore!==beforeScore)throw Error('Canvas grade was modified during the E2E test');
const afterFeedbacks=(await repository.findByStudent(String(student),String(course))).filter(f=>String(f.tarea_id)===String(assignment));
if(afterFeedbacks.length!==1||!['PENDIENTE','EDITADO'].includes(afterFeedbacks[0].estado)||afterFeedbacks[0].nota_canvas!==null)
  throw Error('Generated feedback is not exactly one ungraded pending draft');
record('GEMINI_DONE',{feedbackId:result.data.id,characters:result.data.content.length,
 languageCheck:!/\\b(Estimado|Estimada|fortalezas|mejoras|calificación|retroalimentación)\\b/i.test(result.data.content),opening:result.data.content.slice(0,95),elapsedMs:Date.now()-started,postedToCanvas:false,gradeChanged:false});
