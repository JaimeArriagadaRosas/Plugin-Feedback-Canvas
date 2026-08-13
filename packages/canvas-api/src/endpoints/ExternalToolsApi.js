export class ExternalToolsApi {
  constructor(client) {
    this.client = client;
  }

  list(accountId) {
    return this.client.request(`/api/v1/accounts/${accountId}/external_tools?include_parents=true`);
  }

  install(accountId, clientId) {
    return this.client.request(`/api/v1/accounts/${accountId}/external_tools`, {
      method: 'POST',
      body: { client_id: clientId },
    });
  }
}
