export class CanvasApiError extends Error {
  constructor(message, { status, body, endpoint, cause } = {}) {
    super(message, { cause });
    this.name = 'CanvasApiError';
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}
