# frozen_string_literal: true
require 'json'

puts "Registering LTI 1.3 Developer Key..."
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
  puts "ERROR: LTI_PLACEMENT_JSON is not defined or is empty."
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
  title: "Adaptive Feedback",
  description: "Adaptive AI Feedback Plugin",
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
  # Explicitly install the LTI button in the account
  puts "Installing ContextExternalTool to ensure the button appears..."
  tool = ContextExternalTool.where(developer_key_id: key.id, context: Account.default).first_or_initialize
  tool.name = "Unida"
  tool.developer_key_id = key.id
  tool.consumer_key = 'Oauth2'
  tool.shared_secret = 'secret'
  tool.domain = URI.parse(plugin_url).host rescue 'localhost'
  tool.use_1_3 = true
  tool.workflow_state = "public"
  # Clear old placements and copy from current configuration
  tool.settings = {}
  tool_config.placements.each do |p|
    tool.settings[p["placement"].to_sym] = p
  end
  tool.custom_fields = tool_config.custom_fields
  tool.save!
  puts "ContextExternalTool installed successfully."

  # Inject global JS for session logs in the frontend
  js_url = "#{plugin_url}/api/canvas/canvas-logs.js"
  if Account.default.settings[:global_javascript] != js_url || !Account.default.settings[:global_includes]
    Account.default.settings[:global_javascript] = js_url
    Account.default.settings[:global_includes] = true
    Account.default.save!
    puts "global_javascript configured in Account.default: #{js_url}"
  end
rescue => e
  puts "Warning: Error injecting Custom Theme JS or LTI: #{e.message}"
  puts e.backtrace
  exit 1
end
