# Creates one isolated, ungraded synthetic Classic Quiz in LOCAL Canvas only.
raise 'Local Canvas fixture confirmation is required' unless ENV['CONFIRM_ENGLISH_QUIZ_FIXTURE']=='YES'
course=Course.find(1)
student=User.find(9)
teacher=User.find(3)
raise 'Not an English Canvas fixture course' unless course.name.include?('Software Architecture')
title='English Qualitative Feedback E2E - Ungraded Classic Quiz'
existing=course.quizzes.find_by(title:title)
if existing
  quiz=existing
  submission=quiz.assignment&.submissions&.find_by(user_id:student.id)
  puts "EXISTING quiz=#{quiz.id} assignment=#{quiz.assignment&.id} student=#{student.id} score=#{submission&.score.inspect}"
  exit 0
end
ActiveRecord::Base.transaction do
  quiz=course.quizzes.create!(title:title,quiz_type:'assignment',points_possible:20,workflow_state:'available',due_at:7.days.from_now)
  quiz.quiz_questions.create!(question_data:{
    question_name:'Architecture and reliability',
    question_text:'Explain how an API Gateway and a Circuit Breaker support resilient services.',
    question_type:'essay_question',
    points_possible:20,
    answers:[]
  })
  quiz.generate_quiz_data
  quiz.save!
  task=quiz.assignment
  raise 'Canvas failed to create the associated assignment' unless task
  finish=Time.now-10.minutes
  started=finish-15.minutes
  snapshot=quiz.quiz_data
  raise 'Question snapshot missing' unless snapshot.is_a?(Array)&&snapshot.size==1
  question=quiz.quiz_questions.first
  answers=[{question_id:question.id,text:'An API Gateway centralizes request routing and authentication. A Circuit Breaker protects downstream dependencies from repeated calls during failures by opening after a threshold and recovering gradually.'}]
  attempt=Quizzes::QuizSubmission.create!(quiz_id:quiz.id,user_id:student.id,workflow_state:'pending_review',attempt:1,started_at:started,finished_at:finish,quiz_data:snapshot,submission_data:answers)
  submission=task.submissions.find_or_create_by!(user_id:student.id)
  submission.update!(submission_type:'online_quiz',submitted_at:finish,workflow_state:'pending_review',body:nil,score:nil,grade:nil,grader_id:nil)
  raise 'Unexpected quiz score' unless attempt.reload.score.nil? && submission.reload.score.nil?
  puts "CREATED quiz=#{quiz.id} assignment=#{task.id} student=#{student.id} attempt=#{attempt.id} quiz_data=#{attempt.quiz_data&.size} score=#{submission.score.inspect}"
end
