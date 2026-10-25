import { DomainError } from '../../utils/errors.js';

const MAX_BYTES = 12 * 1024 * 1024;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'canvas.docker']);

function normalizedDownloadUrl(value, base, localTlsPort = 8443) {
  const url = new URL(value, base);
  // Canvas Local redirects to HTTP on the TLS-only port; correct the scheme, not the host.
  if (LOCAL_HOSTS.has(url.hostname.toLowerCase()) && url.protocol === 'http:' && Number(url.port) === localTlsPort) {
    url.protocol = 'https:';
  }
  return url;
}

function trusted(url, base) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
  if (LOCAL_HOSTS.has(url.hostname.toLowerCase())) return LOCAL_HOSTS.has(base.hostname.toLowerCase());
  if (url.protocol !== 'https:') return false;
  return url.hostname.toLowerCase() === base.hostname.toLowerCase()
    || ['.instructure.com', '.amazonaws.com', '.cloudfront.net'].some(suffix => url.hostname.toLowerCase().endsWith(suffix));
}

function canAuthenticate(url, base) {
  return url.origin === base.origin
    || (LOCAL_HOSTS.has(url.hostname.toLowerCase()) && LOCAL_HOSTS.has(base.hostname.toLowerCase()));
}

export default class SubmissionAttachmentDownloader {
  constructor(adapter) { this.adapter = adapter; }

  async download(file, teacherId) {
    if (!file?.id) throw new DomainError('Attachment has no Canvas file ID', 422, 'ATTACHMENT_ID_MISSING');
    const metadata = await this.adapter._fetchWithToken('/files/' + encodeURIComponent(String(file.id)), teacherId);
    if (!metadata?.url) throw new DomainError('Canvas did not return an attachment URL', 422, 'ATTACHMENT_URL_MISSING');

    const base = new URL(this.adapter.httpClient.canvasBaseUrl);
    const tlsPort = Number(process.env.TLS_LISTEN_PORT || 8443);
    const token = await this.adapter.resolveToken(teacherId);
    let url = normalizedDownloadUrl(metadata.url, base, tlsPort);

    for (let redirects = 0; redirects <= 4; redirects++) {
      if (!trusted(url, base)) throw new DomainError('Attachment download URL is outside allowed origins', 422, 'ATTACHMENT_ORIGIN');
      const headers = canAuthenticate(url, base) ? { Authorization: 'Bearer ' + token } : {};
      let response;
      try {
        response = await fetch(url, {
          headers,
          dispatcher: this.adapter.httpClient.dispatcher,
          redirect: 'manual',
          signal: AbortSignal.timeout(15000)
        });
      } catch (error) {
        throw new DomainError('Connection failed while downloading attachment: ' + (error.cause?.message || error.message), 502, 'ATTACHMENT_CONNECTION_FAILED');
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects === 4) throw new DomainError('Too many attachment redirects', 502, 'ATTACHMENT_REDIRECT_LIMIT');
        const location = response.headers.get('location');
        if (!location) throw new DomainError('Redirect has no destination', 502, 'ATTACHMENT_REDIRECT_INVALID');
        url = normalizedDownloadUrl(new URL(location, url), base, tlsPort);
        continue;
      }
      if (!response.ok) throw new DomainError('Canvas rejected the download (HTTP ' + response.status + ')', 502, 'ATTACHMENT_DOWNLOAD_FAILED');
      if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new DomainError('Attachment exceeds 12 MiB', 413);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_BYTES) throw new DomainError('Attachment exceeds 12 MiB', 413);
      return {
        buffer,
        mime: String(metadata.content_type || file.content_type || response.headers.get('content-type') || '').split(';')[0].toLowerCase()
      };
    }
  }
}
