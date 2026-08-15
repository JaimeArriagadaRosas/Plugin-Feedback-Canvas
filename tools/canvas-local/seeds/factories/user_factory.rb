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
    user.locale = 'en'
    user.save!
    user
  end

  def self.create_users
    puts "Creating development users..."
    
    # System service account (infrastructure only, not a real person)
    system = get_or_create_user("system@canvas.local", "Plugin System Account", "password123")
    Account.default.update!(default_locale: 'en')
    Account.default.account_users.create!(user: system) unless Account.default.account_users.find_by(user_id: system.id)

    admin = get_or_create_user("admin@canvas.local", "System Administrator", "password123")
    Account.default.account_users.create!(user: admin) unless Account.default.account_users.find_by(user_id: admin.id)

    teacher1 = get_or_create_user("teacher@canvas.local", "Dr. Elena Ramirez", "password123")
    teacher2 = get_or_create_user("teacher2@canvas.local", "Prof. Carlos M.", "password123")
    teacher3 = get_or_create_user("teacher3@canvas.local", "Dr. Ana Z.", "password123")

    students_data = [
      { email: "student1@canvas.local", name: "John Smith", password: "password123" },
      { email: "student2@canvas.local", name: "Mary Johnson", password: "password123" },
      { email: "student3@canvas.local", name: "Peter Brown", password: "password123" },
      { email: "student4@canvas.local", name: "Anna Torres", password: "password123" },
      { email: "student5@canvas.local", name: "Charles Mendez", password: "password123" }
    ]

    students = students_data.map do |s|
      u = get_or_create_user(s[:email], s[:name], s[:password])
      { id: u.id, name: u.name, email: s[:email] }
    end

    {
      system: system,
      admin: admin,
      teachers: [teacher1, teacher2, teacher3],
      students: students
    }
  end

  def self.regenerate_dev_token(user)
    user.access_tokens.where(purpose: 'Local Dev Token').destroy_all
    user.access_tokens.create!(purpose: 'Local Dev Token').full_token
  end

  # Idempotent locale migration — updates existing records to English
  def self.migrate_existing_to_english
    puts "Migrating existing user locales to English..."
    Account.default.update!(default_locale: 'en')
    User.find_each do |u|
      if u.locale == 'es'
        u.locale = 'en'
        u.save!
      end
    end
    puts "Locale migration complete."
  end
end
