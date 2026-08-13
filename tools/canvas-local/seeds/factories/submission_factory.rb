require 'fileutils'

module SubmissionFactory
  def self.create_assignments_and_submissions(courses, admin, students)
    puts "Creando tareas dinámicas y entregas para los cursos..."
    
    courses.each do |c|
      teacher_for_course = c.teachers.first || admin
      
      # Tarea 1: Quiz (Aislado para comportamiento nativo de Canvas)
      t1 = create_quiz_assignment(c)
      
      # Tarea 2: Documento (Subida enriquecida)
      t2 = c.assignments.where(title: "Ensayo de Investigación: #{c.name}").first_or_create!
      t2.update!(points_possible: 50, workflow_state: 'published', submission_types: 'online_upload', due_at: 10.days.from_now)
      
      # Tarea 3: Desarrollo Práctico (Texto)
      t3 = c.assignments.where(title: "Desarrollo Práctico: #{c.name}").first_or_create!
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
    quiz = c.quizzes.where(title: "Control de Conceptos: #{c.name}").first_or_create!
    quiz.update!(
      quiz_type: 'assignment',
      points_possible: 100,
      workflow_state: 'available',
      due_at: 7.days.from_now
    )
    
    if quiz.quiz_questions.count == 0
      quiz.quiz_questions.create!(question_data: { question_name: "Pregunta 1", question_text: "¿Qué es MVC?", question_type: "multiple_choice_question", points_possible: 25, answers: [{answer_text: "Un patrón de diseño", weight: 100, id: 1}, {answer_text: "Una base de datos", weight: 0, id: 2}] })
      quiz.quiz_questions.create!(question_data: { question_name: "Pregunta 2", question_text: "¿Qué significa API?", question_type: "multiple_choice_question", points_possible: 25, answers: [{answer_text: "Application Programming Interface", weight: 100, id: 3}, {answer_text: "Apple Protocol Interface", weight: 0, id: 4}] })
      quiz.quiz_questions.create!(question_data: { question_name: "Pregunta 3", question_text: "¿Qué es HTTP?", question_type: "multiple_choice_question", points_possible: 25, answers: [{answer_text: "Un protocolo de transferencia", weight: 100, id: 5}, {answer_text: "Un lenguaje de marcas", weight: 0, id: 6}] })
      quiz.quiz_questions.create!(question_data: { question_name: "Pregunta 4", question_text: "¿Qué es JSON?", question_type: "multiple_choice_question", points_possible: 25, answers: [{answer_text: "JavaScript Object Notation", weight: 100, id: 7}, {answer_text: "Java Serialized Object Network", weight: 0, id: 8}] })
      quiz.generate_quiz_data
      quiz.save!
    end
    quiz.assignment
  end

  def self.create_rubric(c, assignments)
    rubric_data = [
      {
        id: "crit1",
        description: "Comprensión y Contenido",
        long_description: "Evalúa si el estudiante domina los conceptos clave.",
        points: 50,
        ratings: [
          { description: "Excelente", points: 50, id: "rat1" },
          { description: "Suficiente", points: 25, id: "rat2" },
          { description: "Insuficiente", points: 0, id: "rat3" }
        ]
      },
      {
        id: "crit2",
        description: "Desarrollo y Estructura",
        long_description: "Evalúa la claridad y el formato de la entrega.",
        points: 50,
        ratings: [
          { description: "Excelente", points: 50, id: "rat4" },
          { description: "Insuficiente", points: 0, id: "rat5" }
        ]
      }
    ]

    rubric = Rubric.create!(
      context: c,
      title: "Rúbrica General - #{c.name}",
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
        body: "Resultados automáticos: El alumno completó el quiz.",
        submitted_at: qs.finished_at,
        workflow_state: 'graded',
        grade: score.to_s,
        score: score,
        graded_at: Time.now,
        grader_id: teacher.id
      )

    elsif type_index == 1
      # UPLOAD (Copiar dinámica de master)
      sub = assignment.submissions.find_or_create_by!(user_id: student_user.id)
      extensions = ['.pdf', '.pptx', '.xlsx', '.zip']
      chosen_ext = extensions.sample
      filename = "#{student_user.name.gsub(' ', '_').downcase}_entrega#{chosen_ext}"
      
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
        body_text = "Se ha adjuntado el archivo #{filename}."
        
      rescue => e
        attachment_ids = nil
        body_text = "[SIMULA SER UN ARCHIVO ADJUNTO: #{filename}]\n\nFallback visual: No se puede leer este tipo de archivo #{chosen_ext} debido a un error: #{e.message}"
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
        puts "Error guardando entrega upload: #{save_err.message}"
      end
      
      if is_graded && sub.workflow_state == 'graded'
        sub.update(grade: score.to_s, score: score, graded_at: Time.now, grader_id: teacher.id)
      end

    elsif type_index == 2
      # TEXT ENTRY
      sub = assignment.submissions.find_or_create_by!(user_id: student_user.id)
      is_graded = rand > 0.3 
      score = is_graded ? rand(min_pts..max_pts) : nil
      
      detailed_text = "Para la implementación del desarrollo práctico solicitado, he considerado los siguientes puntos clave:<br/><br/>1. Diseño de Arquitectura: Se utilizó un enfoque basado en microservicios, asegurando la escalabilidad horizontal. Se incluyó un API Gateway para centralizar el enrutamiento y la autenticación.<br/><br/>2. Base de Datos: Se optó por una arquitectura políglota, utilizando PostgreSQL para datos transaccionales y MongoDB para el catálogo de productos no estructurado.<br/><br/>3. Seguridad: Se implementaron tokens JWT con rotación asimétrica (RSA-256) y validación de scopes por rol. Todas las comunicaciones internas están cifradas mediante mTLS.<br/><br/>El repositorio con el código fuente se encuentra alojado en GitHub y los pipelines de CI/CD están configurados usando GitHub Actions. A continuación presento los fragmentos principales del modelo de dominio..."
      
      begin
        sub.update!(
          submission_type: 'online_text_entry',
          body: detailed_text,
          submitted_at: Time.now - rand(1..5).days,
          workflow_state: is_graded ? 'graded' : 'submitted'
        )
      rescue => save_err
        puts "Error guardando entrega text: #{save_err.message}"
      end

      if is_graded && sub.workflow_state == 'graded'
        sub.update(grade: score.to_s, score: score, graded_at: Time.now, grader_id: teacher.id)
      end
    end
  end
end
