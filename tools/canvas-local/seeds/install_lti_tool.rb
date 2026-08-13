# frozen_string_literal: true
require 'json'

puts "Registrando Developer Key LTI 1.3..."
host = (ENV['CANVAS_BASE_URL'] || 'https://localhost:8080').sub(/\/$/, '')
plugin_url = (ENV['PLUGIN_BACKEND_URL'] || ENV['VITE_BACKEND_URL'] || 'https://localhost:3000').sub(/\/$/, '')
frontend_url = (ENV['FRONTEND_URL'] || "#{host}/").sub(/\/$/, '')
key = DeveloperKey.where(name: "Plugin Feedback LTI").first_or_initialize
key.assign_attributes(
  name: "Plugin Feedback LTI",
  email: "admin@canvas.local",
  redirect_uris: ["#{plugin_url}/api/lti/callback"],
  oidc_initiation_url: "#{plugin_url}/api/lti/login",
  client_type: "confidential",
  is_lti_key: true
)
key.generate_rsa_keypair!(overwrite: true)
key.save!

binding = DeveloperKeyAccountBinding.find_or_create_by!(
  developer_key: key,
  account: Account.default
)
binding.workflow_state = "on"
binding.save!

tool_config = Lti::ToolConfiguration.where(developer_key: key).first_or_initialize

placements_json_string = ENV['LTI_PLACEMENT_JSON']
if placements_json_string.nil? || placements_json_string.strip.empty?
  puts "ERROR: LTI_PLACEMENT_JSON no está definido o está vacío."
  exit 1
end

placements_json = JSON.parse(placements_json_string)
placements_from_json = placements_json.dig('extensions', 0, 'settings', 'placements') || []

placements = placements_from_json.map do |p|
  {
    "placement" => p["placement"],
    "text" => p["text"],
    "target_link_uri" => "#{plugin_url}/api/lti/callback",
    "message_type" => p["message_type"],
    "visibility" => p["visibility"] || "members",
    "required_permissions" => p["required_permissions"],
    "custom" => p["custom"],
    "default" => p["default"] || "enabled",
    "windowTarget" => p["windowTarget"] || "_blank"
  }.compact
end



tool_config.assign_attributes(
  title: "Feedback Adaptativo",
  description: "Plugin de Feedback Adaptativo con IA",
  target_link_uri: "#{plugin_url}/api/lti/callback",
  oidc_initiation_url: "#{plugin_url}/api/lti/login",
  public_jwk_url: "#{plugin_url}/api/lti/jwks",
  privacy_level: "public",
  custom_fields: {
    "canvas_course_id" => "$Canvas.course.id",
    "canvas_assignment_id" => "$Canvas.assignment.id",
    "canvas_user_id" => "$Canvas.user.id",
    "canvas_user_login_id" => "$Canvas.user.loginId"
  },
  placements: placements
)
tool_config.save!

puts "=== LTI CONFIGURATION ==="
puts "LTI_CLIENT_ID:#{key.global_id}"
puts "========================="

begin
  # Instalamos explícitamente el botón LTI en la cuenta
  puts "Instalando ContextExternalTool para asegurar que el botón aparezca..."
  tool = ContextExternalTool.where(developer_key_id: key.id, context: Account.default).first_or_initialize
  tool.name = "Unida"
  tool.developer_key_id = key.id
  tool.consumer_key = 'Oauth2'
  tool.shared_secret = 'secret'
  tool.domain = URI.parse(plugin_url).host rescue 'localhost'
  tool.use_1_3 = true
  tool.workflow_state = "public"
  # Limpiamos placements antiguas y copiamos las de la configuración actual
  tool.settings = {}
  tool_config.placements.each do |p|
    tool.settings[p["placement"].to_sym] = p
  end
  tool.custom_fields = tool_config.custom_fields
  tool.save!
  puts "ContextExternalTool instalado correctamente."

  # Inyectamos el JS global para logs de sesión en el frontend
  js_url = "#{plugin_url}/api/canvas/canvas-logs.js"
  if Account.default.settings[:global_javascript] != js_url || !Account.default.settings[:global_includes]
    Account.default.settings[:global_javascript] = js_url
    Account.default.settings[:global_includes] = true
    Account.default.save!
    puts "global_javascript configurado en Account.default: #{js_url}"
  end
rescue => e
  puts "Advertencia: Error al inyectar el Custom Theme JS o LTI: #{e.message}"
  puts e.backtrace
  exit 1
end
