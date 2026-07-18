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
      account: Account.default
    )
    user.communication_channels.create!(path: email) { |cc| cc.workflow_state = "active" }
  end
  user
end

admin = get_or_create_user("admin@canvas.local", "Admin Sistema", "password123")
Account.default.account_users.create!(user: admin) unless Account.default.account_users.find_by(user_id: admin.id)

teacher = get_or_create_user("profesor@canvas.local", "Dr. Elena Ramirez", "password123")

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
  { name: "Seminario de Título", code: "SEM-404" }
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

puts "Matriculando usuarios en todos los cursos..."
cursos_creados.each do |c|
  c.enroll_user(teacher, 'TeacherEnrollment', enrollment_state: 'active') unless c.teachers.include?(teacher)
  students.each do |s|
    u = User.find_by(id: s[:id])
    c.enroll_user(u, 'StudentEnrollment', enrollment_state: 'active') unless c.students.include?(u)
  end
end

puts "Creando tareas y entregas en el primer curso..."
course = cursos_creados.first # Mantiene compatibilidad
as1 = course.assignments.where(title: "Examen Parcial: Arquitectura de Software").first_or_create!
as1.update!(points_possible: 100, workflow_state: 'published', submission_types: 'online_text_entry')
as2 = course.assignments.where(title: "Proyecto Final: Sistema de Gestión").first_or_create!
as2.update!(points_possible: 100, workflow_state: 'published', submission_types: 'online_text_entry')
as3 = course.assignments.where(title: "Control 1: Diagramas de Secuencia").first_or_create!
as3.update!(points_possible: 20, workflow_state: 'published', submission_types: 'online_text_entry')

puts "Creando algunas tareas en los otros cursos..."
cursos_creados[1..].each do |c|
  t1 = c.assignments.where(title: "Evaluación Diagnóstica").first_or_create!
  t1.update!(points_possible: 50, workflow_state: 'published', submission_types: 'online_text_entry')
  t2 = c.assignments.where(title: "Trabajo de Investigación").first_or_create!
  t2.update!(points_possible: 100, workflow_state: 'published', submission_types: 'online_text_entry')
end

def create_submission_and_grade(assignment, student_id, score, comment_text, teacher)
  student_user = User.find(student_id)
  sub = assignment.submissions.find_or_create_by!(user_id: student_user.id)
  sub.update!(
    submission_type: 'online_text_entry',
    body: "Entregado por #{student_user.name} para #{assignment.title}.",
    submitted_at: Time.now - 1.day,
    workflow_state: score ? 'graded' : 'submitted'
  )
  if score
    sub.update!(grade: score.to_s, score: score, graded_at: Time.now, grader_id: teacher.id)
    if comment_text
      begin
        sub.add_comment(author: teacher, comment: comment_text)
      rescue => e
        sub.submission_comments.create!(author: teacher, comment: comment_text)
      end
    end
  end
end

# Juan Perez (Student 1)
create_submission_and_grade(as1, students[0][:id], 90, "Buen trabajo Juan. Tu nota es 6.0/7.0. Has demostrado un gran entendimiento de los patrones de diseño.", teacher)
create_submission_and_grade(as2, students[0][:id], 85, "Buen desarrollo de la arquitectura en capas. Tu nota es 5.5/7.0.", teacher)
create_submission_and_grade(as3, students[0][:id], nil, nil, teacher) # Pendiente de calificación

# Maria Garcia (Student 2)
create_submission_and_grade(as1, students[1][:id], 50, "Faltó profundidad en las respuestas de patrones. Nota: 3.5/7.0.", teacher)
create_submission_and_grade(as2, students[1][:id], 60, "Implementación básica con detalles menores.", teacher)

# Pedro Lopez (Student 3)
create_submission_and_grade(as1, students[2][:id], 40, "Requiere bastante apoyo en diagramación y SOLID. Nota: 2.8/7.0.", teacher)

# Ana Torres (Student 4)
create_submission_and_grade(as1, students[3][:id], 80, "Excelente nivel de abstracción. Nota: 5.2/7.0.", teacher)

# Carlos Mendez (Student 5)
create_submission_and_grade(as1, students[4][:id], 100, "Excelente desempeño, puntaje perfecto. Nota: 7.0/7.0.", teacher)

puts "=== CANVAS DATA ==="
puts "COURSE_ID:#{course.id}"
puts "TEACHER_EMAIL:profesor@canvas.local"
puts "CANVAS_API_TOKEN:#{teacher.access_tokens.where(purpose: 'Local Dev Token').first_or_create!.full_token}"
students.each do |s|
  u = User.find_by(id: s[:id])
  token = u.access_tokens.where(purpose: 'Local Dev Token').first_or_create!.full_token
  puts "STUDENT_EMAIL:#{s[:email]}"
  puts "STUDENT_TOKEN_#{s[:id]}:#{token}"
end
puts "========================="

perfiles = {
  "usuarios" => [
    { "id" => admin.id, "nombre" => admin.name, "email" => "admin@canvas.local", "rol" => "admin", "token" => nil },
    { "id" => teacher.id, "nombre" => teacher.name, "email" => "profesor@canvas.local", "rol" => "teacher", "token" => teacher.access_tokens.where(purpose: "Local Dev Token").first_or_create!.full_token }
  ] + students.map { |s| u = User.find_by(id: s[:id]); { "id" => s[:id], "nombre" => s[:name], "email" => s[:email], "rol" => "student", "token" => u.access_tokens.where(purpose: "Local Dev Token").first_or_create!.full_token } }
}
File.write("/usr/src/app/tmp/perfiles_data.json", JSON.generate(perfiles))
puts "Perfiles escritos en tmp/perfiles_data.json"
