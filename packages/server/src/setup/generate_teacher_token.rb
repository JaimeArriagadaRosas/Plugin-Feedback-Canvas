# generate_teacher_token.rb
# Genera (o reutiliza) un Access Token de API para el usuario profesor del
# Canvas Local y lo devuelve en formato JSON por STDOUT para que el orquestador
# Node.js lo persista en perfiles_data.json.
#
# NOTA: En Canvas LMS la tabla `users` NO tiene columna `email`; el correo
# vive en `communication_channels` (path_type='email'). Por eso se busca por
# join, no por User.where(email: ...).
require 'json'

teacher_email = ENV['TEACHER_EMAIL'] || 'profesor@canvas.local'
teacher_id = ENV['TEACHER_ID'].presence

if teacher_id.present?
  teacher = User.where(id: teacher_id.to_i).first
else
  teacher = User.joins(:communication_channels)
                .where(communication_channels: { path: teacher_email, path_type: 'email' })
                .first
end

if teacher.nil?
  puts "TEACHER_NOT_FOUND"
  exit 1
end

# AccessToken#full_token solo está disponible justo tras la creación, por lo
# que lo capturamos inmediatamente. Si existe uno previo del plugin pero ya no
# expone el token plano, generamos uno nuevo para garantizar autenticación.
existing = teacher.access_tokens.where(purpose: 'plugin-feedback-teacher').first
plain_token = existing&.full_token

if plain_token.nil?
  # Canvas requiere que el API token supere AccessToken#authorized_for_account?,
  # que delega en la DeveloperKey. La DeveloperKey por defecto ("User-Generated")
  # NO está autorizada para Account.default y la del plugin LTI tiene
  # require_scopes=true sin scopes definidos (imposible asignar scopes válidos).
  # Por eso creamos/usamos una DeveloperKey de API dedicada, sin require_scopes
  # y bound a Account.default, bajo la cual el token autentica sin restricciones.
  api_key = DeveloperKey.where(name: 'Plugin Feedback API').first_or_initialize
  api_key.account = Account.default
  api_key.email = 'soporte@pluginfeedback.local'
  api_key.workflow_state = 'active'
  api_key.visible = true
  api_key.require_scopes = false
  api_key.auto_expire_tokens = false
  api_key.user = teacher
  api_key.save!
  # El binding activo en Account.default es lo que realmente habilita la key
  # (DeveloperKeyAccountBinding workflow_state='on'); sin él, authorized_for_account? es false.
  binding = DeveloperKeyAccountBinding.where(
    account_id: Account.default.id,
    developer_key_id: api_key.id
  ).first_or_initialize
  binding.workflow_state = 'on'
  binding.save!
  token = teacher.access_tokens.create!(
    purpose: 'plugin-feedback-teacher',
    token_hint: 'Plugin Feedback (profesor local)',
    expires_at: nil,
    developer_key: api_key
  )
  plain_token = token.full_token
end

if plain_token.nil? || plain_token.empty?
  puts "TOKEN_GENERATION_FAILED"
  exit 1
end

result = {
  user_id: teacher.id,
  email: teacher_email,
  token: plain_token
}

puts "TEACHER_TOKEN_JSON_START"
puts result.to_json
puts "TEACHER_TOKEN_JSON_END"
