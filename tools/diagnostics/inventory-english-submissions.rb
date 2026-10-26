Submission.where(score: nil).where.not(submitted_at: nil).limit(40).each do |submission|
  puts [submission.assignment.context_id,submission.assignment_id,submission.user_id,submission.submission_type,submission.workflow_state,submission.attachments.map(&:display_name).join(',')].join('|')
end
