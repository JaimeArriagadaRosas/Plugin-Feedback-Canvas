require 'fileutils'

module SubmissionFactory
  def self.create_assignments_and_submissions(courses, admin, students)
    puts "Creating dynamic assignments and submissions for courses..."
    
    courses.each do |c|
      teacher_for_course = c.teachers.first || admin
      
      # Assignment 1: Quiz (Isolated for native Canvas behavior)
      t1 = create_quiz_assignment(c)
      
      # Assignment 2: Document (Rich upload)
      t2 = c.assignments.where(title: "Research Essay: #{c.name}").first_or_create!
      t2.update!(points_possible: 50, workflow_state: 'published', submission_types: 'online_upload', due_at: 10.days.from_now)
      
      # Assignment 3: Practical Development (Text)
      t3 = c.assignments.where(title: "Practical Development: #{c.name}").first_or_create!
      t3.update!(points_possible: nil, workflow_state: 'published', submission_types: 'online_text_entry', due_at: 14.days.from_now)
      
      create_rubric(c, [t1, t2, t3])

      students.each do |s_data|
        student_user = User.find(s_data[:id])
        create_submission_with_logic(t1, student_user, teacher_for_course, 0)
        create_submission_with_logic(t2, student_user, teacher_for_course, 1)
        create_submission_with_logic(t3, student_user, teacher_for_course, 2)
      end
    end
  end

  private

  def self.create_quiz_assignment(c)
    quiz = c.quizzes.where(title: "Concept Check: #{c.name}").first_or_create!
    quiz.update!(
      quiz_type: 'assignment',
      points_possible: 100,
      workflow_state: 'available',
      due_at: 7.days.from_now
    )
    
    if quiz.quiz_questions.count == 0
      quiz.quiz_questions.create!(question_data: { question_name: "Question 1", question_text: "What is MVC?", question_type: "multiple_choice_question", points_possible: 25, answers: [{answer_text: "A design pattern", weight: 100, id: 1}, {answer_text: "A database", weight: 0, id: 2}] })
      quiz.quiz_questions.create!(question_data: { question_name: "Question 2", question_text: "What does API stand for?", question_type: "multiple_choice_question", points_possible: 25, answers: [{answer_text: "Application Programming Interface", weight: 100, id: 3}, {answer_text: "Apple Protocol Interface", weight: 0, id: 4}] })
      quiz.quiz_questions.create!(question_data: { question_name: "Question 3", question_text: "What is HTTP?", question_type: "multiple_choice_question", points_possible: 25, answers: [{answer_text: "A transfer protocol", weight: 100, id: 5}, {answer_text: "A markup language", weight: 0, id: 6}] })
      quiz.quiz_questions.create!(question_data: { question_name: "Question 4", question_text: "What is JSON?", question_type: "multiple_choice_question", points_possible: 25, answers: [{answer_text: "JavaScript Object Notation", weight: 100, id: 7}, {answer_text: "Java Serialized Object Network", weight: 0, id: 8}] })
      quiz.generate_quiz_data
      quiz.save!
    end
    quiz.assignment
  end

  def self.create_rubric(c, assignments)
    rubric_data = [
      {
        id: "crit1",
        description: "Understanding and Content",
        long_description: "Evaluates whether the student demonstrates mastery of key concepts.",
        points: 50,
        ratings: [
          { description: "Excellent", points: 50, id: "rat1" },
          { description: "Satisfactory", points: 25, id: "rat2" },
          { description: "Insufficient", points: 0, id: "rat3" }
        ]
      },
      {
        id: "crit2",
        description: "Development and Structure",
        long_description: "Evaluates the clarity and format of the submission.",
        points: 50,
        ratings: [
          { description: "Excellent", points: 50, id: "rat4" },
          { description: "Insufficient", points: 0, id: "rat5" }
        ]
      }
    ]

    rubric = Rubric.create!(
      context: c,
      title: "General Rubric - #{c.name}",
      data: rubric_data
    )

    assignments.each do |assignment|
      next unless assignment
      RubricAssociation.create!(
        rubric: rubric,
        association_object: assignment,
        context: c,
        purpose: 'grading',
        use_for_grading: true
      )
    end
  end

  def self.create_submission_with_logic(assignment, student_user, teacher, type_index)
    return unless assignment
    return if rand < 0.10 # 10% chance of no submission

    max_pts = assignment.points_possible || 100
    min_pts = (max_pts * 0.4).to_i

    if type_index == 0
      # QUIZ
      score = rand(min_pts..max_pts)
      quiz = assignment.quiz
      submission_data = quiz.quiz_questions.map do |qq|
        answers = qq.question_data[:answers]
        correct_ans = answers.find { |a| a[:weight] == 100 }
        wrong_ans = answers.find { |a| a[:weight] == 0 }
        selected = rand < 0.8 ? correct_ans : wrong_ans
        {
          question_id: qq.id,
          correct: selected == correct_ans,
          points: selected == correct_ans ? qq.question_data[:points_possible] : 0,
          answer_id: selected[:id],
          text: selected[:answer_text] || selected[:text]
        }
      end

      qs = Quizzes::QuizSubmission.where(quiz_id: quiz.id, user_id: student_user.id).first_or_create!
      qs.update!(
        workflow_state: 'complete',
        score: score,
        kept_score: score,
        finished_at: Time.now - rand(1..5).days,
        submission_data: submission_data
      )
      
      sub = assignment.submissions.find_or_create_by!(user_id: student_user.id)
      sub.update!(
        submission_type: 'online_quiz',
        body: "Automatic results: student completed the quiz.",
        submitted_at: qs.finished_at,
        workflow_state: 'graded',
        grade: score.to_s,
        score: score,
        graded_at: Time.now,
        grader_id: teacher.id
      )

    elsif type_index == 1
      # UPLOAD (Copy from master template)
      sub = assignment.submissions.find_or_create_by!(user_id: student_user.id)
      extensions = ['.pdf', '.pptx', '.xlsx', '.zip']
      chosen_ext = extensions.sample
      filename = "#{student_user.name.gsub(' ', '_').downcase}_submission#{chosen_ext}"
      
      attachment_ids = nil
      body_text = ""
      
      begin
        master_path = File.join('/tmp', 'seeds', 'masters', "dummy#{chosen_ext}")
        generated_dir = File.join('/tmp', 'generated_mock_files')
        FileUtils.mkdir_p(generated_dir)
        
        file_path = File.join(generated_dir, filename)
        
        if File.exist?(master_path)
          FileUtils.cp(master_path, file_path)
        else
          # Fallback if master is missing inside container for some reason
          File.write(file_path, "Fallback file content for #{filename}")
        end
        
        mime_types = {
          '.pdf' => 'application/pdf',
          '.pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          '.xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.zip' => 'application/zip'
        }

        begin
          uploaded = ActionDispatch::Http::UploadedFile.new(
            tempfile: File.new(file_path),
            filename: filename,
            type: mime_types[chosen_ext] || 'application/octet-stream'
          )
        rescue
          uploaded = File.open(file_path)
        end
        
        att = Attachment.create!(
          context: student_user,
          filename: filename,
          display_name: filename,
          uploaded_data: uploaded,
          workflow_state: 'unattached'
        )
        attachment_ids = att.id.to_s
        body_text = "File #{filename} has been attached."
        
      rescue => e
        attachment_ids = nil
        body_text = "[SIMULATES A FILE ATTACHMENT: #{filename}]\n\nVisual fallback: Cannot read this file type #{chosen_ext} due to an error: #{e.message}"
      end

      is_graded = rand > 0.5
      score = is_graded ? rand(min_pts..max_pts) : nil
      
      begin
        sub.update!(
          submission_type: attachment_ids ? 'online_upload' : 'online_text_entry',
          body: body_text,
          attachment_ids: attachment_ids,
          submitted_at: Time.now - rand(1..5).days,
          workflow_state: is_graded ? 'graded' : 'submitted'
        )
      rescue => save_err
        puts "Error saving upload submission: #{save_err.message}"
      end
      
      if is_graded && sub.workflow_state == 'graded'
        sub.update(grade: score.to_s, score: score, graded_at: Time.now, grader_id: teacher.id)
      end

    elsif type_index == 2
      # TEXT ENTRY
      sub = assignment.submissions.find_or_create_by!(user_id: student_user.id)
      is_graded = rand > 0.3 
      score = is_graded ? rand(min_pts..max_pts) : nil
      
      detailed_text = "For the practical development implementation requested, I have considered the following key points:<br/><br/>1. Architecture Design: A microservices-based approach was used, ensuring horizontal scalability. An API Gateway was included to centralize routing and authentication.<br/><br/>2. Database: A polyglot architecture was chosen, using PostgreSQL for transactional data and MongoDB for the unstructured product catalog.<br/><br/>3. Security: JWT tokens with asymmetric rotation (RSA-256) and role-based scope validation were implemented. All internal communications are encrypted using mTLS.<br/><br/>The repository with the source code is hosted on GitHub and the CI/CD pipelines are configured using GitHub Actions. The main fragments of the domain model are presented below..."
      
      begin
        sub.update!(
          submission_type: 'online_text_entry',
          body: detailed_text,
          submitted_at: Time.now - rand(1..5).days,
          workflow_state: is_graded ? 'graded' : 'submitted'
        )
      rescue => save_err
        puts "Error saving text submission: #{save_err.message}"
      end

      if is_graded && sub.workflow_state == 'graded'
        sub.update(grade: score.to_s, score: score, graded_at: Time.now, grader_id: teacher.id)
      end
    end
  end
end
