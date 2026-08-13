import {
  CanvasApiClient,
  DeveloperKeysApi,
  ExternalToolsApi,
} from '@plugin-feedback/canvas-api';

export class CanvasDeploymentService {
  constructor({ baseUrl, token, fetchImpl }) {
    const client = new CanvasApiClient({ baseUrl, token, fetchImpl });
    this.developerKeys = new DeveloperKeysApi(client);
    this.externalTools = new ExternalToolsApi(client);
  }

  async ensureDeveloperKey(accountId, toolConfiguration) {
    const name = toolConfiguration.title || 'Unida Feedback LTI';
    const existing = await this.developerKeys.list(accountId);
    const matchingKey = existing.find((key) => key.name === name);
    if (matchingKey) return matchingKey.id;

    const result = await this.developerKeys.createToolConfiguration(accountId, {
      developer_key: {
        name,
        email: 'admin@unab.cl',
        notes: 'Generado automáticamente por el instalador de Plugin Feedback.',
        visible: true,
      },
      tool_configuration: { settings: toolConfiguration },
    });
    return result.developer_key.id;
  }

  async enableDeveloperKey(keyId) {
    const result = await this.developerKeys.update(keyId, {
      developer_key: { workflow_state: 'on' },
    });
    if (result.workflow_state !== 'on') {
      throw new Error('Canvas no confirmó la activación de la Developer Key.');
    }
  }

  async ensureExternalTool(accountId, clientId) {
    const existing = await this.externalTools.list(accountId);
    const matchingTool = existing.find((tool) => String(tool.client_id) === String(clientId));
    if (matchingTool) return matchingTool.id;
    const installed = await this.externalTools.install(accountId, clientId);
    return installed.id;
  }
}
