// servicios/ia/IAProvider.js
export default class IAProvider {
  async generateFeedback(prompt, config) {
    throw new Error("Method generateFeedback() must be implemented");
  }

  async fetchAvailableModels(apiKey) {
    throw new Error("Method fetchAvailableModels() must be implemented");
  }

  async testConnection(apiKey) {
    throw new Error("Method testConnection() must be implemented");
  }
}
