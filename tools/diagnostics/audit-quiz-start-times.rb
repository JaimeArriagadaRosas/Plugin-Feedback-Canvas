scope=Quizzes::QuizSubmission.where(workflow_state: 'complete')
rows=scope.select(:id,:quiz_id,:user_id,:started_at,:finished_at)
puts "total=#{rows.length} missing_start=#{rows.count{|s|s.started_at.nil?}} missing_finish=#{rows.count{|s|s.finished_at.nil?}}"
rows.first(8).each{|s|puts "id=#{s.id} quiz=#{s.quiz_id} user=#{s.user_id} start=#{s.started_at.inspect} finish=#{s.finished_at.inspect}"}
