import {describe,it,expect} from 'vitest';
import QuizAnswerFacade from '../../src/adapters/canvas/QuizAnswerFacade.js';
const csv='id,submitted,1: Explain API Gateway,25.0,25.0\n7,2026-10-25 15:00:00 UTC,Routes and authenticates requests,25,25\n';
function facade(){
  return new QuizAnswerFacade({
    _fetchAllWithToken:async()=>[{id:6,assignment_id:16}],
    _fetchWithToken:async(endpoint)=>{
      if(endpoint.endsWith('/questions'))return {quiz_submission_questions:[{id:1,question_text:'Explain API Gateway'}]};
      if(endpoint.endsWith('/reports'))return [{report_type:'student_analysis',file:{id:45,filename:'student_analysis.csv'}}];
      return {quiz_submissions:[{id:25,user_id:7,workflow_state:'complete',attempt:1,finished_at:'2026-10-25T15:00:00Z'}]};
    },
    downloadSubmissionAttachment:async()=>({buffer:Buffer.from(csv)})
  });
}
describe('Canvas Student Analysis duplicate-header regression',()=>{
  it('handles duplicate score headers and extracts only the student answer',async()=>{
    const answers=await facade().getQuizAnswers(1,16,7,'teacher');
    expect(answers).toEqual([{question_id:1,question_text:'Explain API Gateway',answer:'Routes and authenticates requests'}]);
  });
});
