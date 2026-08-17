# frozen_string_literal: true
require 'json'
require_relative 'factories/user_factory'
require_relative 'factories/course_factory'
require_relative 'factories/submission_factory'

puts "=== Starting modular test seed injection ==="

# 1. Create users
users = UserFactory.create_users
system = users[:system]
admin = users[:admin]
teachers = users[:teachers]
students = users[:students]

# 2. Create courses and enroll users
courses = CourseFactory.create_courses(admin, teachers, students)

# 3. Create assignments (Quizzes/Uploads/Text) and generate submissions
SubmissionFactory.create_assignments_and_submissions(courses, admin, students)

# 4. Generate local tokens for the frontend
system_token = UserFactory.regenerate_dev_token(system)
admin_token = UserFactory.regenerate_dev_token(admin)
teacher1_token = UserFactory.regenerate_dev_token(teachers[0])
teacher2_token = UserFactory.regenerate_dev_token(teachers[1])
teacher3_token = UserFactory.regenerate_dev_token(teachers[2])

students_with_tokens = students.map do |s|
  u = User.find_by(id: s[:id])
  token = UserFactory.regenerate_dev_token(u)
  s.merge({ token: token, uuid: u.uuid })
end

puts "=== CANVAS DATA ==="
puts "SYSTEM_TOKEN:#{system_token}"
puts "COURSE_ID:#{courses[0].id}"
puts "TEACHER_EMAIL:profesor@canvas.local"
puts "CANVAS_API_TOKEN:#{teacher1_token}"
students_with_tokens.each do |s|
  puts "STUDENT_EMAIL:#{s[:email]}"
  puts "STUDENT_TOKEN_#{s[:id]}:#{s[:token]}"
end
puts "========================="

perfiles = {
  "usuarios" => [
    { "id" => system.id, "uuid" => system.uuid, "nombre" => system.name, "email" => "system@canvas.local", "rol" => "system", "token" => system_token },
    { "id" => admin.id, "uuid" => admin.uuid, "nombre" => admin.name, "email" => "admin@canvas.local", "rol" => "admin", "token" => admin_token },
    { "id" => teachers[0].id, "uuid" => teachers[0].uuid, "nombre" => teachers[0].name, "email" => "profesor@canvas.local", "rol" => "teacher", "token" => teacher1_token },
    { "id" => teachers[1].id, "uuid" => teachers[1].uuid, "nombre" => teachers[1].name, "email" => "profesor2@canvas.local", "rol" => "teacher", "token" => teacher2_token },
    { "id" => teachers[2].id, "uuid" => teachers[2].uuid, "nombre" => teachers[2].name, "email" => "profesor3@canvas.local", "rol" => "teacher", "token" => teacher3_token }
  ] + students_with_tokens.map { |s| { "id" => s[:id], "uuid" => s[:uuid], "nombre" => s[:name], "email" => s[:email], "rol" => "student", "token" => s[:token] } }
}
File.write("/usr/src/app/tmp/perfiles_data.json", JSON.generate(perfiles))
puts "Profiles written to tmp/perfiles_data.json"
puts "=== Seed injection complete ==="
