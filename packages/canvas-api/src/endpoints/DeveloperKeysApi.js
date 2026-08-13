export class DeveloperKeysApi {
  constructor(client) {
    this.client = client;
  }

  list(accountId) {
    return this.client.request(`/api/v1/accounts/${accountId}/developer_keys`);
  }

  createToolConfiguration(accountId, payload) {
    return this.client.request(`/api/v1/accounts/${accountId}/developer_keys/tool_configuration`, {
      method: 'POST',
      body: payload,
    });
  }

  update(keyId, payload) {
    return this.client.request(`/api/v1/developer_keys/${keyId}`, {
      method: 'PUT',
      body: payload,
    });
  }
}
