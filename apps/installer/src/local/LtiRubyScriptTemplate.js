const LTI_CONFIGURATION_SCRIPT = `
    account = Account.default
    begin
      if defined?(Setting)
        Setting.set('canvas_domain', canvas_domain) if Setting.respond_to?(:set)
      end
      if account.respond_to?(:domain) && account.domain.to_s != canvas_domain
        account.settings[:canvas_domain] = canvas_domain if account.respond_to?(:settings)
        account.save! rescue nil
      end
    rescue => e
    end

    key = DeveloperKey.where(name: 'Plugin Feedback LTI').first_or_initialize
    key.email = 'support@pluginfeedback.local'
    key.workflow_state = 'active'
    key.vendor_code = 'pluginfeedback'
    key.visible = true
    key.client_type = 'confidential'
    key.is_lti_key = true
    key.require_scopes = false
    key.scopes = [
      'url:GET|/api/v1/users/:id',
      'url:GET|/api/v1/users/:user_id/profile',
      'url:GET|/api/v1/users/:user_id/courses',
      'url:GET|/api/v1/courses',
      'url:GET|/api/v1/courses/:id',
      'url:GET|/api/v1/courses/:course_id/users',
      'url:GET|/api/v1/courses/:course_id/assignments',
      'url:GET|/api/v1/courses/:course_id/assignments/:id',
      'url:PUT|/api/v1/courses/:course_id/assignments/:id',
      'url:POST|/api/v1/courses/:course_id/assignments',
      'url:GET|/api/v1/courses/:course_id/quizzes',
      'url:GET|/api/v1/courses/:course_id/quizzes/:quiz_id/questions',
      'url:GET|/api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id',
      'url:PUT|/api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id',
      'url:GET|/api/v1/courses/:course_id/students/submissions',
      'url:GET|/api/v1/courses/:course_id/enrollments',
      'url:POST|/api/v1/conversations'
    ]

    key.generate_rsa_keypair!(overwrite: true)
    key.save!
    key.redirect_uris = "#{plugin_url}/api/lti/callback\\n#{plugin_url}/api/oauth2/canvas/callback"
    tool_config = key.tool_configuration || key.build_tool_configuration
    tool_config.settings = nil if tool_config.respond_to?(:settings=)
    tool_config.title = 'Feedback'
    tool_config.description = 'Provides surveys and feedback on the course experience'
    tool_config.target_link_uri = "#{plugin_url}/api/lti/callback"
    tool_config.public_jwk_url = "#{internal_plugin_url}/api/lti/jwks"
    tool_config.oidc_initiation_url = "#{plugin_url}/api/lti/login"

    if lti_config['custom_fields']
      if tool_config.respond_to?(:custom_fields=)
        tool_config.custom_fields = lti_config['custom_fields']
      elsif tool_config.respond_to?(:settings)
        tool_config.settings ||= {}
        tool_config.settings[:custom_fields] = lti_config['custom_fields']
      end
    end

    placements_data = lti_config.dig('extensions', 0, 'settings', 'placements') || lti_config['placements'] || []
    placements_array = placements_data.map do |p|
      {
        text: p['text'], placement: p['placement'], message_type: p['message_type'],
        target_link_uri: p['target_link_uri'], url: p['target_link_uri'],
        windowTarget: p['windowTarget'], visibility: p['visibility'],
        default: p['default'] || 'enabled', canvas_icon_class: p['canvas_icon_class']
      }
    end
    tool_config.placements = placements_array
    key.save!

    registration = key.lti_registration || key.build_lti_registration(account_id: account.id)
    registration.name = "Plugin Feedback LTI"
    registration.workflow_state = 'active'
    registration.save!

    binding = DeveloperKeyAccountBinding.where(
      account_id: account.id,
      developer_key_id: key.id
    ).first_or_initialize
    binding.workflow_state = 'on'
    binding.save!

    tool = ContextExternalTool.where(context_id: account.id, context_type: 'Account', developer_key_id: key.id).first_or_initialize
    tool.name = "Feedback"
    tool.description = "Provides surveys and feedback on the course experience"
    tool.consumer_key = "Oauth2"
    tool.shared_secret = "secret"
    tool.workflow_state = 'public'
    tool.use_1_3 = true
    tool.url = "#{plugin_url}/api/lti/callback"
    tool.custom_fields = lti_config['custom_fields'] if lti_config['custom_fields']

    tool_config.placements.each do |p|
      ext = p['placement'].to_sym
      p_sym = p.each_with_object({}) { |(k, v), memo| memo[k.to_sym] = v }
      tool.set_extension_setting(ext, p_sym)
    end

    require 'uri'
    tool.domain = URI.parse(plugin_url).host rescue "localhost"
    tool.save!

    if account.root_account.feature_enabled?(:lti_registrations_next)
      cc = Lti::ContextControl.find_or_initialize_by(
        deployment_id: tool.id.to_s,
        account_id: account.id
      )
      cc.registration_id = registration.id
      cc.available = true
      cc.workflow_state = 'active'
      cc.save!
    end
`;

export function generateLtiRubyScript(options) {
  return [buildScriptHeader(options), LTI_CONFIGURATION_SCRIPT, buildScriptFooter(options.globalJsUrl)].join('\n');
}

function buildScriptHeader({ ltiJson, pluginUrl, internalPluginUrl, canvasDomain }) {
  return `
    require 'json'
    lti_json_str = <<~JSON_EOF
    ${ltiJson}
    JSON_EOF
    plugin_url = '${pluginUrl}'
    internal_plugin_url = '${internalPluginUrl}'
    canvas_domain = '${canvasDomain}'

    begin
      lti_config = JSON.parse(lti_json_str)
    rescue JSON::ParserError
      exit 1
    end
`;
}

function buildScriptFooter(globalJsUrl) {
  return `
    diagnostic_js = '${globalJsUrl}'
    if diagnostic_js && !diagnostic_js.empty?
      if account.settings[:global_javascript] != diagnostic_js || !account.settings[:global_includes]
        account.settings[:global_javascript] = diagnostic_js
        account.settings[:global_includes] = true
        account.save!
        puts "GLOBAL_JS_UPDATED"
      end
    end

    puts "LTI_CLIENT_ID:#{key.global_id}"
    puts "LTI_CLIENT_SECRET:#{key.api_key}"
    puts "SUCCESS"
  `;
}
