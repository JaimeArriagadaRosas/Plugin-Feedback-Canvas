import { CanvasApiError } from './CanvasApiError.js';
import { getNextLink } from './pagination.js';

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) throw new TypeError('CanvasApiClient requires baseUrl.');
  return baseUrl.replace(/\/+$/u, '');
}

function serializeBody(body, headers) {
  if (body === undefined || body === null || typeof body === 'string') return body;
  if (body instanceof URLSearchParams || body?.constructor?.name?.includes('FormData')) return body;
  headers.set('content-type', 'application/json');
  return JSON.stringify(body);
}

export class CanvasApiClient {
  constructor({ baseUrl, token, fetchImpl = globalThis.fetch, dispatcher, timeoutMs = 45_000 }) {
    if (typeof fetchImpl !== 'function') throw new TypeError('No fetch implementation exists.');
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.dispatcher = dispatcher;
    this.timeoutMs = timeoutMs;
  }

  resolveUrl(endpoint) {
    if (/^https?:\/\//iu.test(endpoint)) return endpoint;
    const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${normalized}`;
  }

  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs);
    const headers = new Headers(options.headers || {});
    headers.set('accept', 'application/json');
    const token = options.token ?? this.token;
    if (token) headers.set('authorization', `Bearer ${token}`);

    try {
      const response = await this.fetchImpl(this.resolveUrl(endpoint), {
        ...options,
        body: serializeBody(options.body, headers),
        dispatcher: options.dispatcher || this.dispatcher,
        headers,
        signal: options.signal || controller.signal,
      });
      if (options.returnResponse) return response;
      if (!response.ok) await this.throwResponseError(endpoint, response);
      if (response.status === 204) return null;
      return response.json();
    } catch (error) {
      if (error instanceof CanvasApiError) throw error;
      throw new CanvasApiError(`Could not call Canvas: ${error.message}`, {
        endpoint,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async throwResponseError(endpoint, response) {
    const body = await response.text().catch(() => '');
    throw new CanvasApiError(`Canvas responded HTTP ${response.status}.`, {
      status: response.status,
      body,
      endpoint,
    });
  }

  async requestAll(endpoint, options = {}) {
    const results = [];
    let nextUrl = this.resolveUrl(endpoint);
    const maxPages = options.maxPages || 50;
    for (let page = 0; nextUrl && page < maxPages; page += 1) {
      const response = await this.request(nextUrl, { ...options, returnResponse: true });
      if (!response.ok) await this.throwResponseError(nextUrl, response);
      const data = await response.json();
      results.push(...(Array.isArray(data) ? data : [data]));
      nextUrl = getNextLink(response.headers.get('link'));
    }
    return results;
  }
}
