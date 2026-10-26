[[1,2,6],[1,3,7],[3,8,10],[2,5,9],[5,14,7]].each do |course, assignment, student|
  s = Submission.find_by(assignment_id: assignment, user_id: student)
  puts [course,assignment,student,s&.workflow_state,s&.score,s&.grade,s&.submission_type].join('|')
end
Submission.where(submission_type: 'online_quiz').limit(12).each do |s|
  puts ['QUIZ',s.assignment.context_id,s.assignment_id,s.user_id,s.workflow_state,s.score].join('|')
end
