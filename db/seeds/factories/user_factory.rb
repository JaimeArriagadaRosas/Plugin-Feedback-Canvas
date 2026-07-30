module UserFactory
  def self.get_or_create_user(email, name, password)
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

  def self.create_users
    puts "Creando usuarios ficticios..."
    
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

    {
      admin: admin,
      teachers: [teacher1, teacher2, teacher3],
      students: students
    }
  end

  def self.regenerate_dev_token(user)
    user.access_tokens.where(purpose: 'Local Dev Token').destroy_all
    user.access_tokens.create!(purpose: 'Local Dev Token').full_token
  end
end
