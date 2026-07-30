module CourseFactory
  def self.create_courses(admin, teachers, students)
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
    teacher1, teacher2, teacher3 = teachers

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

    cursos_creados
  end
end
