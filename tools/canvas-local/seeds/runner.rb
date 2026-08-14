# frozen_string_literal: true
require 'json'
require_relative 'factories/user_factory'
require_relative 'factories/course_factory'
require_relative 'factories/submission_factory'

puts "=== Starting modular test seed injection ==="

# 0. Idempotent locale migration (for existing installations)
UserFactory.migrate_existing_to_english

# 1. Create users
users = UserFactory.create_users
admin = users[:admin]
teachers = users[:teachers]
students = users[:students]

# 2. Create courses and enroll users
courses = CourseFactory.create_courses(admin, teachers, students)

# 3. Create assignments (Quizzes/Uploads/Text) and generate submissions
SubmissionFactory.create_assignments_and_submissions(courses, admin, students)

# 4. Generate local tokens for the frontend
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
puts "COURSE_ID:#{courses[0].id}"
puts "TEACHER_EMAIL:teacher@canvas.local"
puts "CANVAS_API_TOKEN:#{teacher1_token}"
students_with_tokens.each do |s|
  puts "STUDENT_EMAIL:#{s[:email]}"
  puts "STUDENT_TOKEN_#{s[:id]}:#{s[:token]}"
end
puts "========================="

profiles = {
  "users" => [
    { "id" => admin.id, "uuid" => admin.uuid, "name" => admin.name, "email" => "admin@canvas.local", "role" => "admin", "token" => admin_token },
    { "id" => teachers[0].id, "uuid" => teachers[0].uuid, "name" => teachers[0].name, "email" => "teacher@canvas.local", "role" => "teacher", "token" => teacher1_token },
    { "id" => teachers[1].id, "uuid" => teachers[1].uuid, "name" => teachers[1].name, "email" => "teacher2@canvas.local", "role" => "teacher", "token" => teacher2_token },
    { "id" => teachers[2].id, "uuid" => teachers[2].uuid, "name" => teachers[2].name, "email" => "teacher3@canvas.local", "role" => "teacher", "token" => teacher3_token }
  ] + students_with_tokens.map { |s| { "id" => s[:id], "uuid" => s[:uuid], "name" => s[:name], "email" => s[:email], "role" => "student", "token" => s[:token] } }
}
File.write("/usr/src/app/tmp/profiles_data.json", JSON.generate(profiles))
puts "Profiles written to tmp/profiles_data.json"
puts "=== Seed injection complete ==="
