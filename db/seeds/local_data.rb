# frozen_string_literal: true
require 'json'
puts "Creando usuarios ficticios..."

def get_or_create_user(email, name, password)
  pseudonym = Account.default.pseudonyms.active.by_unique_id(email).first
  user = pseudonym ? pseudonym.user : User.create!(name: name)
  user.register! unless user.registered?
  unless pseudonym
    pseudonym = user.pseudonyms.create!(
      unique_id: email,
      password: password,
      password_confirmation: password,
    )
    user.communication_channels.create!(path: email) { |cc| cc.workflow_state = "active" }
  end
  user.locale = 'es'
  user.save!
  user
end

admin = get_or_create_user("admin@canvas.local", "Admin Sistema", "password123")
Account.default.update!(default_locale: 'es')
Account.default.account_users.create!(user: admin) unless Account.default.account_users.find_by(user_id: admin.id)

teacher1 = get_or_create_user("profesor@canvas.local", "Dr. Elena Ramirez", "password123")
teacher2 = get_or_create_user("profesor2@canvas.local", "Prof. Carlos M.", "password123")
teacher3 = get_or_create_user("profesor3@canvas.local", "Dra. Ana Z.", "password123")

students_data = [
  { email: "estudiante1@canvas.local", name: "Juan Perez", password: "password123" },
  { email: "estudiante2@canvas.local", name: "Maria Garcia", password: "password123" },
  { email: "estudiante3@canvas.local", name: "Pedro Lopez", password: "password123" },
  { email: "estudiante4@canvas.local", name: "Ana Torres", password: "password123" },
  { email: "estudiante5@canvas.local", name: "Carlos Mendez", password: "password123" }
]

students = students_data.map do |s|
  u = get_or_create_user(s[:email], s[:name], s[:password])
  { id: u.id, name: u.name, email: s[:email] }
end

puts "Creando cursos de prueba..."
cursos_data = [
  { name: "Arquitectura de Software", code: "ARQ-101" },
  { name: "Sistemas Distribuidos", code: "SIS-202" },
  { name: "Ingeniería Web", code: "WEB-303" },
  { name: "Seminario de Título", code: "SEM-404" },
  { name: "Base de Datos Avanzada", code: "BDA-505" }
]

cursos_creados = []
cursos_data.each do |c_data|
  c = Course.where(course_code: c_data[:code]).first
  unless c
    c = Course.create!(name: c_data[:name], course_code: c_data[:code], account: Account.default)
    c.offer!
  end
  cursos_creados << c
end

puts "Matriculando usuarios en los cursos..."
cursos_creados[0].enroll_user(teacher1, 'TeacherEnrollment', enrollment_state: 'active') unless cursos_creados[0].teachers.include?(teacher1)
cursos_creados[1].enroll_user(teacher1, 'TeacherEnrollment', enrollment_state: 'active') unless cursos_creados[1].teachers.include?(teacher1)
cursos_creados[2].enroll_user(teacher2, 'TeacherEnrollment', enrollment_state: 'active') unless cursos_creados[2].teachers.include?(teacher2)
cursos_creados[3].enroll_user(teacher3, 'TeacherEnrollment', enrollment_state: 'active') unless cursos_creados[3].teachers.include?(teacher3)
cursos_creados[4].enroll_user(teacher2, 'TeacherEnrollment', enrollment_state: 'active') unless cursos_creados[4].teachers.include?(teacher2)

cursos_creados.each do |c|
  students.each do |s|
    u = User.find_by(id: s[:id])
    c.enroll_user(u, 'StudentEnrollment', enrollment_state: 'active') unless c.students.include?(u)
  end
end

puts "Creando tareas dinámicas y entregas para los 5 cursos..."

def create_submission_with_logic(assignment, student_user, teacher, type_index)
  # 10% chance of no submission
  return if rand < 0.10

  sub = assignment.submissions.find_or_create_by!(user_id: student_user.id)
  
  if type_index == 0
    # QUIZ (Auto-graded)
    score = rand(40..100)
    sub.update!(
      submission_type: 'online_text_entry',
      body: "Resultados automáticos: El alumno obtuvo #{score}/100 en el control de alternativas.",
      submitted_at: Time.now - rand(1..5).days,
      workflow_state: 'graded',
      grade: score.to_s,
      score: score,
      graded_at: Time.now,
      grader_id: teacher.id
    )
  elsif type_index == 1
    # UPLOAD (PDF, PPTX, XLSX, RAR, ZIP)
    extensions = ['.pdf', '.pptx', '.xlsx', '.rar', '.zip']
    chosen_ext = extensions.sample
    filename = "#{student_user.name.gsub(' ', '_').downcase}_entrega#{chosen_ext}"
    
    begin
      # Inyectar archivo real desde mock_files
      mock_ext = chosen_ext
      mock_ext = '.zip' if chosen_ext == '.rar' # Usar dummy.zip para entregas de tipo .rar
      file_path = File.join(__dir__, 'mock_files', "dummy#{mock_ext}")
      
      mime_types = {
        '.pdf' => 'application/pdf',
        '.pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.zip' => 'application/zip',
        '.rar' => 'application/vnd.rar'
      }

      if File.exist?(file_path)
        # Primer intento: usar Rack/ActionDispatch que es lo que Canvas prefiere
        begin
          uploaded = ActionDispatch::Http::UploadedFile.new(
            tempfile: File.new(file_path),
            filename: filename,
            type: mime_types[chosen_ext] || 'application/octet-stream'
          )
        rescue
          # Segundo intento si falla la librería: pasar el File directamente
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
      else
        raise "Mock file no encontrado: #{file_path}"
      end
    rescue => e
      attachment_ids = nil
      body_text = "[SIMULA SER UN ARCHIVO ADJUNTO: #{filename}]\n\nFallback de archivo debido a error de DB local: #{e.message}"
    end

    is_graded = rand > 0.5
    score = is_graded ? rand(40..100) : nil
    
    sub.update!(
      submission_type: 'online_upload',
      body: body_text,
      attachment_ids: attachment_ids,
      submitted_at: Time.now - rand(1..5).days,
      workflow_state: is_graded ? 'graded' : 'submitted'
    )
    
    if is_graded
      sub.update!(grade: score.to_s, score: score, graded_at: Time.now, grader_id: teacher.id)
      comment = "Revisión de tu entrega de archivo. Puntaje: #{score}."
      begin
        sub.add_comment(author: teacher, comment: comment)
      rescue
        sub.submission_comments.create!(author: teacher, comment: comment)
      end
    end

  elsif type_index == 2
    # TEXT ENTRY
    is_graded = rand > 0.7 # 30% graded, 70% pending
    score = is_graded ? rand(40..100) : nil
    
    sub.update!(
      submission_type: 'online_text_entry',
      body: "Respuesta de desarrollo de #{student_user.name} para la tarea '#{assignment.title}'. Aquí explico los conceptos solicitados...",
      submitted_at: Time.now - rand(1..5).days,
      workflow_state: is_graded ? 'graded' : 'submitted'
    )

    if is_graded
      sub.update!(grade: score.to_s, score: score, graded_at: Time.now, grader_id: teacher.id)
      comment = "Buen desarrollo. Nota: #{score}."
      begin
        sub.add_comment(author: teacher, comment: comment)
      rescue
        sub.submission_comments.create!(author: teacher, comment: comment)
      end
    end
  end
end

cursos_creados.each do |c|
  teacher_for_course = c.teachers.first || admin
  
  # 1. Tarea tipo Quiz
  t1 = c.assignments.where(title: "Control de Conceptos: #{c.name}").first_or_create!
  t1.update!(points_possible: 100, workflow_state: 'published', submission_types: 'online_text_entry')
  
  # 2. Tarea tipo Documento
  t2 = c.assignments.where(title: "Ensayo de Investigación: #{c.name}").first_or_create!
  t2.update!(points_possible: 100, workflow_state: 'published', submission_types: 'online_upload')
  
  # 3. Tarea tipo Desarrollo
  t3 = c.assignments.where(title: "Desarrollo Práctico: #{c.name}").first_or_create!
  t3.update!(points_possible: 100, workflow_state: 'published', submission_types: 'online_text_entry')

  students.each do |s_data|
    student_user = User.find(s_data[:id])
    create_submission_with_logic(t1, student_user, teacher_for_course, 0)
    create_submission_with_logic(t2, student_user, teacher_for_course, 1)
    create_submission_with_logic(t3, student_user, teacher_for_course, 2)
  end
end

puts "=== CANVAS DATA ==="
puts "COURSE_ID:#{cursos_creados[0].id}"
puts "TEACHER_EMAIL:profesor@canvas.local"
puts "CANVAS_API_TOKEN:#{teacher1.access_tokens.where(purpose: 'Local Dev Token').first_or_create!.full_token}"
students.each do |s|
  u = User.find_by(id: s[:id])
  token = u.access_tokens.where(purpose: 'Local Dev Token').first_or_create!.full_token
  puts "STUDENT_EMAIL:#{s[:email]}"
  puts "STUDENT_TOKEN_#{s[:id]}:#{token}"
end
puts "========================="

perfiles = {
  "usuarios" => [
    { "id" => admin.id, "uuid" => admin.uuid, "nombre" => admin.name, "email" => "admin@canvas.local", "rol" => "admin", "token" => admin.access_tokens.where(purpose: "Local Dev Token").first_or_create!.full_token },
    { "id" => teacher1.id, "uuid" => teacher1.uuid, "nombre" => teacher1.name, "email" => "profesor@canvas.local", "rol" => "teacher", "token" => teacher1.access_tokens.where(purpose: "Local Dev Token").first_or_create!.full_token },
    { "id" => teacher2.id, "uuid" => teacher2.uuid, "nombre" => teacher2.name, "email" => "profesor2@canvas.local", "rol" => "teacher", "token" => teacher2.access_tokens.where(purpose: "Local Dev Token").first_or_create!.full_token },
    { "id" => teacher3.id, "uuid" => teacher3.uuid, "nombre" => teacher3.name, "email" => "profesor3@canvas.local", "rol" => "teacher", "token" => teacher3.access_tokens.where(purpose: "Local Dev Token").first_or_create!.full_token }
  ] + students.map { |s| u = User.find_by(id: s[:id]); { "id" => s[:id], "uuid" => u.uuid, "nombre" => s[:name], "email" => s[:email], "rol" => "student", "token" => u.access_tokens.where(purpose: "Local Dev Token").first_or_create!.full_token } }
}
File.write("/usr/src/app/tmp/perfiles_data.json", JSON.generate(perfiles))
puts "Perfiles escritos en tmp/perfiles_data.json"
