# canvas_lti_1_3_installer.rb
require 'json'

def fail_with(message)
  puts "ERROR: #{message}"
  exit 1
end

lti_json_str = ENV['LTI_PLACEMENT_JSON']
plugin_url = ENV['PLUGIN_URL']
internal_plugin_url = ENV['INTERNAL_PLUGIN_URL'] || plugin_url

fail_with("Falta LTI_PLACEMENT_JSON") if lti_json_str.nil? || lti_json_str.empty?
fail_with("Falta PLUGIN_URL") if plugin_url.nil? || plugin_url.empty?

begin
  lti_config = JSON.parse(lti_json_str)
rescue JSON::ParserError
  fail_with("LTI_PLACEMENT_JSON no es un JSON válido")
end

account = Account.default

# 0. Forzar el dominio de Canvas a localhost:8080.
#
# CAUSA RAÍZ de "launch_no_longer_valid": Canvas embebe su dominio efectivo
# (HostUrl.default_host) dentro del lti_message_hint como "canvas_domain"
# (ver app/models/lti/lti_advantage_adapter.rb). Si ese dominio apunta al
# plugin (localhost:3000) en lugar de a Canvas (localhost:8080), el paso
# authorize_redirect rebota el flujo OIDC al plugin, provocando un doble salto
# que puede consumir/expirar el launch cacheado antes de tiempo.
#
# domain.yml define localhost:8080, pero el valor puede quedar cacheado o ser
# sobreescrito por un Setting. Lo fijamos explícitamente para el dominio raíz.
begin
  canvas_domain = ENV['CANVAS_DOMAIN'] || 'localhost:8080'
  if defined?(Setting)
    Setting.set('canvas_domain', canvas_domain) if Setting.respond_to?(:set)
  end
  # Persistir también en el propio account por si se usa como fallback.
  if account.respond_to?(:domain) && account.domain.to_s != canvas_domain
    account.settings[:canvas_domain] = canvas_domain if account.respond_to?(:settings)
    account.save! rescue nil
  end
  puts "[Rails-LtiInstaller] canvas_domain forzado a #{canvas_domain}."
rescue => e
  puts "[Rails-LtiInstaller] AVISO: no se pudo forzar canvas_domain (#{e.message})."
end

# 1. Buscar o inicializar la Developer Key
key = DeveloperKey.where(name: 'Plugin Feedback LTI').first_or_initialize
key.email = 'soporte@pluginfeedback.local'
key.workflow_state = 'active'
key.vendor_code = 'pluginfeedback'
key.visible = true
key.client_type = 'confidential'
key.is_lti_key = true
key.generate_rsa_keypair!(overwrite: true)
key.save!

# 2. Configurar la herramienta LTI 1.3 en el Developer Key
key.redirect_uris = "#{plugin_url}/api/lti/callback"

# Forzar recreación de ToolConfiguration para limpiar configuración previa
if key.tool_configuration&.persisted?
  key.tool_configuration.destroy
end
key.build_tool_configuration
tool_config = key.tool_configuration

# Limpiar settings previos para forzar regeneración
tool_config.settings = nil if tool_config.respond_to?(:settings)

tool_config.title = 'Feedback'
tool_config.description = 'Provee encuestas y feedback sobre la experiencia del curso'
tool_config.target_link_uri = "#{plugin_url}/api/lti/callback"
tool_config.public_jwk_url = "#{internal_plugin_url}/api/lti/jwks"
tool_config.oidc_initiation_url = "#{plugin_url}/api/lti/login"

# Extraer placements desde el JSON oficial de Canvas LTI 1.3
placements_data = lti_config.dig('extensions', 0, 'settings', 'placements') || lti_config['placements'] || []

# Mapear y sanear los placements para LTI 1.3
placements_array = []
placements_data.each do |p|
  placements_array << {
    text: p['text'],
    placement: p['placement'],
    message_type: p['message_type'],
    target_link_uri: p['target_link_uri'],
    url: p['target_link_uri'],
    windowTarget: p['windowTarget'],
    visibility: p['visibility'],
    default: p['default'] || 'enabled',
    canvas_icon_class: p['canvas_icon_class']
  }
end

# Configuración moderna LTI 1.3 (tool_config.placements)
tool_config.placements = placements_array

key.save!

# 3. Restaurar o inicializar LtiRegistration (vital para Canvas LTI 1.3 nativo)
registration = key.lti_registration || key.build_lti_registration(account_id: account.id)
registration.name = "Plugin Feedback LTI"
registration.workflow_state = 'active'
registration.save!

# Habilitar la herramienta en el Account (DeveloperKeyAccountBinding)
binding = DeveloperKeyAccountBinding.where(
  account_id: account.id,
  developer_key_id: key.id
).first_or_initialize
binding.workflow_state = 'on'
binding.save!

# 3. Crear la ContextExternalTool global en Account.default
tool = ContextExternalTool.new(
  context: account,
  developer_key_id: key.id,
  name: "Feedback",
  description: "Provee encuestas y feedback sobre la experiencia del curso",
  consumer_key: "Oauth2",
  shared_secret: "secret",
  workflow_state: 'public'
)

# ¡ESTA LÍNEA ES MÁGICA! Fuerza a Canvas a usar el flujo OIDC (LTI 1.3) y no hacer un fallback a LTI 1.1
tool.use_1_3 = true

puts "[Rails-LtiInstaller] Configurando URL de inicio de sesión OIDC (tool.url)..."
tool.url = "#{plugin_url}/api/lti/callback"

puts "[Rails-LtiInstaller] Sincronizando placements desde ToolConfiguration hacia ContextExternalTool..."
# Sincronizar placements desde ToolConfiguration hacia ContextExternalTool
tool_config.placements.each do |p|
  ext = p['placement'].to_sym
  puts "[Rails-LtiInstaller] Añadiendo placement: #{ext}"
  p_sym = p.each_with_object({}) { |(k, v), memo| memo[k.to_sym] = v }
  
  tool.set_extension_setting(ext, p_sym)
end

# Asegurar que domain también esté configurado (otro requisito de Canvas)
require 'uri'
tool.domain = URI.parse(plugin_url).host rescue "localhost"

# Guardamos la herramienta
tool.save!

# 5. Fix LTI 1.3 visibility filters (lti_registrations_next)
if account.root_account.feature_enabled?(:lti_registrations_next)
  puts "[LTI Installer] Activando Lti::ContextControl para LTI 1.3..."
  cc = Lti::ContextControl.find_or_initialize_by(
    deployment_id: tool.id.to_s,
    account_id: account.id
  )
  cc.registration_id = registration.id
  cc.available = true
  cc.workflow_state = 'active'
  cc.save!
  puts "[LTI Installer] Lti::ContextControl (ID: #{cc.id}) guardado."
end
# 4. Configurar JavaScript Global de diagnóstico si se provee
diagnostic_js = ENV['CANVAS_GLOBAL_JS_URL']
if diagnostic_js && !diagnostic_js.empty?
  if account.settings[:global_javascript] != diagnostic_js || !account.settings[:global_includes]
    account.settings[:global_javascript] = diagnostic_js
    account.settings[:global_includes] = true
    account.save!
    puts "GLOBAL_JS_UPDATED"
  end
end

puts "LTI_CLIENT_ID:#{key.global_id}"
puts "SUCCESS"
