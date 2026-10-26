import fs from 'node:fs';
const users=JSON.parse(fs.readFileSync('tmp/canvas_local_users.json','utf8')).usuarios;
const teacher=users.find(u=>u.rol==='teacher'&&u.token);
const student=users.find(u=>u.id===9&&u.rol==='student'&&u.token);
if(!teacher||!student)throw Error('Local test users are missing');
const base='http://127.0.0.1:8080/api/v1',course=1;
const title='English Qualitative API E2E - Ungraded Essay';
async function api(method,url,user,body){
 const res=await fetch(base+url,{method,headers:{Authorization:'Bearer '+user.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const raw=await res.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw.slice(0,180)}}
 if(!res.ok)throw Error(method+' '+url+' HTTP '+res.status+' '+JSON.stringify(data).slice(0,220));
 return data;
}
let quizzes=await api('GET','/courses/1/quizzes?per_page=100',teacher);
let quiz=quizzes.find(q=>q.title===title);
if(!quiz){
 quiz=await api('POST','/courses/1/quizzes',teacher,{quiz:{title,quiz_type:'assignment',published:false,points_possible:20,allowed_attempts:1}});
 console.log('CREATED_QUIZ='+quiz.id);
}
let questions=await api('GET','/courses/1/quizzes/'+quiz.id+'/questions',teacher);
if(!questions.length){
 const q=await api('POST','/courses/1/quizzes/'+quiz.id+'/questions',teacher,{question:{question_name:'Reliability architecture',question_type:'essay_question',question_text:'Explain API Gateway and Circuit Breaker responsibilities.',points_possible:20}});
 questions=[q];
}
if(questions.length!==1||questions[0].question_type!=='essay_question')throw Error('Unexpected quiz questions');
if(!quiz.published)quiz=await api('PUT','/courses/1/quizzes/'+quiz.id,teacher,{quiz:{published:true}});
if(!quiz.assignment_id)throw Error('Assignment ID unavailable');
let result=await api('GET','/courses/1/quizzes/'+quiz.id+'/submissions',student);
let attempt=result.quiz_submissions?.find(a=>String(a.user_id)===String(student.id));
if(!attempt){
 const start=await api('POST','/courses/1/quizzes/'+quiz.id+'/submissions',student,{});
 attempt=start.quiz_submissions?.[0];
}
if(!attempt)throw Error('Canvas quiz attempt missing');
if(!attempt.finished_at){
 if(!attempt.validation_token)throw Error('Quiz validation token missing');
 const answer='An API Gateway routes requests and handles authentication. A Circuit Breaker stops calls to failing services, reduces cascading failures, and permits recovery.';
 await api('POST','/quiz_submissions/'+attempt.id+'/questions',student,{attempt:attempt.attempt,validation_token:attempt.validation_token,quiz_questions:[{id:questions[0].id,answer}]});
 await api('POST','/courses/1/quizzes/'+quiz.id+'/submissions/'+attempt.id+'/complete',student,{attempt:attempt.attempt,validation_token:attempt.validation_token});
}
const submitted=await api('GET','/courses/1/assignments/'+quiz.assignment_id+'/submissions/'+student.id,teacher);
console.log(JSON.stringify({stage:'GRADE_AUDIT',quiz:quiz.id,assignment:quiz.assignment_id,submissionState:submitted.workflow_state,score:submitted.score,grade:submitted.grade,enteredScore:submitted.entered_score}));
if(submitted.workflow_state!=='pending_review'||!(submitted.score===0&&String(submitted.grade)==='0'))throw Error('Expected pending-review Canvas essay with provisional zero; refusing qualitative E2E');
console.log(JSON.stringify({stage:'FIXTURE_READY',quiz:quiz.id,assignment:quiz.assignment_id,student:student.id,canvasProvisionalScore:0,review:'pending_review'}));
