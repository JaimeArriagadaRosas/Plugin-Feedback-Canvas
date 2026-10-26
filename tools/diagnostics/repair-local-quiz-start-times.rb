# Local synthetic Canvas fixture repair, not a production migration.
raise 'Explicit local fixture confirmation required' unless ENV['CONFIRM_SYNTHETIC_QUIZ_TIME_FIX'] == 'YES'
scope=Quizzes::QuizSubmission.where(workflow_state:'complete',started_at:nil).where.not(finished_at:nil)
rows=scope.to_a
raise "Unexpected fixture count: #{rows.length}" unless rows.length == 20
ActiveRecord::Base.transaction do
  rows.each do |submission|
    quiz=submission.quiz
    unless quiz && quiz.title.start_with?('Concept Check: ') && (1..5).cover?(quiz.id) && (6..10).cover?(submission.user_id)
      raise "Unrecognized quiz fixture #{submission.id}"
    end
    original=[submission.score,submission.kept_score,submission.finished_at,submission.submission_data]
    submission.update_columns(started_at: submission.finished_at - 10.minutes)
    submission.reload
    raise "Fixture metadata changed unexpectedly for #{submission.id}" unless [submission.score,submission.kept_score,submission.finished_at,submission.submission_data]==original
  end
end
puts "REPAIRED #{rows.length} synthetic Classic Quiz started_at fields; scores and finished_at unchanged"
