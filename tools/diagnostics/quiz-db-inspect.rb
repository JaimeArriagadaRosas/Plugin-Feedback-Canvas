quiz = Quizzes::QuizSubmission.where(quiz_id: 1).limit(5)
puts "QUIZ_SUBMISSION_COUNT #{Quizzes::QuizSubmission.where(quiz_id: 1).count}"
quiz.each do |r|
  puts "QUIZ_SUBMISSION id=#{r.id} student=#{r.user_id} state=#{r.workflow_state} attempt=#{r.attempt} answer_count=#{Array(r.submission_data).length}"
end
