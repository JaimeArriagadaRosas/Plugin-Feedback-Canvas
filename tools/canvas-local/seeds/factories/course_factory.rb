module CourseFactory
  def self.create_courses(admin, teachers, students)
    puts "Creating test courses..."
    courses_data = [
      { name: "Software Architecture", code: "ARQ-101" },
      { name: "Distributed Systems", code: "SIS-202" },
      { name: "Web Engineering", code: "WEB-303" },
      { name: "Thesis Seminar", code: "SEM-404" },
      { name: "Advanced Databases", code: "BDA-505" }
    ]

    created_courses = []
    courses_data.each do |c_data|
      c = Course.where(course_code: c_data[:code]).first
      unless c
        c = Course.create!(name: c_data[:name], course_code: c_data[:code], account: Account.default)
        c.offer!
      end
      created_courses << c
    end

    puts "Enrolling users in courses..."
    teacher1, teacher2, teacher3 = teachers

    created_courses[0].enroll_user(teacher1, 'TeacherEnrollment', enrollment_state: 'active') unless created_courses[0].teachers.include?(teacher1)
    created_courses[1].enroll_user(teacher1, 'TeacherEnrollment', enrollment_state: 'active') unless created_courses[1].teachers.include?(teacher1)
    created_courses[2].enroll_user(teacher2, 'TeacherEnrollment', enrollment_state: 'active') unless created_courses[2].teachers.include?(teacher2)
    created_courses[3].enroll_user(teacher3, 'TeacherEnrollment', enrollment_state: 'active') unless created_courses[3].teachers.include?(teacher3)
    created_courses[4].enroll_user(teacher2, 'TeacherEnrollment', enrollment_state: 'active') unless created_courses[4].teachers.include?(teacher2)

    created_courses.each do |c|
      students.each do |s|
        u = User.find_by(id: s[:id])
        c.enroll_user(u, 'StudentEnrollment', enrollment_state: 'active') unless c.students.include?(u)
      end
    end

    created_courses
  end
end
