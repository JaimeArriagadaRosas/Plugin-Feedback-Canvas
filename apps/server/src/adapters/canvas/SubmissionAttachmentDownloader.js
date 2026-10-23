import { DomainError } from '../../utils/errors.js';

const MAX_BYTES = 12 * 1024 * 1024;
function allowed(url, base) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
  const hostname = url.hostname.toLowerCase();
  const local = ['localhost', '127.0.0.1', 'canvas.docker'].includes(hostname);
  if (local) return ['localhost', '127.0.0.1', 'canvas.docker'].includes(base.hostname.toLowerCase());
  return url.protocol === 'https:' && (
    hostname === base.hostname.toLowerCase() ||
    hostname.endsWith('.instructure.com') ||
    hostname.endsWith('.amazonaws.com') ||
    hostname.endsWith('.cloudfront.net')
  );
}

export default class SubmissionAttachmentDownloader {
  constructor(adapter) { this.adapter = adapter; }
  async download(file, teacherId) {
    if (!file?.id) throw new DomainError('Adjunto sin identificador de Canvas', 422, 'ATTACHMENT_ID_MISSING');
    const metadata = await this.adapter._fetchWithToken('/files/' + encodeURIComponent(String(file.id)), teacherId);
    if (!metadata?.url) throw new DomainError('Canvas no devuelve URL para el adjunto', 422, 'ATTACHMENT_URL_MISSING');
    const base = new URL(this.adapter.httpClient.canvasBaseUrl);
    let url = new URL(metadata.url, base);
    const token = await this.adapter.resolveToken(teacherId);
    for (let redirect = 0; redirect <= 4; redirect++) {
      if (!allowed(url, base)) throw new DomainError('URL de descarga fuera de orígenes permitidos', 422, 'ATTACHMENT_ORIGIN');
      const headers = url.origin === base.origin ? { Authorization: 'Bearer ' + token } : {};
      const res = await fetch(url, {headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
      if ([301,302,303,307,308].includes(res.status)) {
        if (redirect === 4) throw new DomainError('Demasiadas redirecciones de adjunto', 502);
        const location = res.headers.get('location');
        if (!location) throw new DomainError('Redirección sin destino', 502);
        url = new URL(location,url);
        continue;
      }
      if (!res.ok) throw new DomainError('No se pudo descargar adjunto desde Canvas (HTTP ' + res.status + ')', 502, 'ATTACHMENT_DOWNLOAD_FAILED');
      if (Number(res.headers.get('content-length')) > MAX_BYTES) throw new DomainError('Archivo demasiado grande', 413);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > MAX_BYTES) throw new DomainError('Archivo demasiado grande', 413);
      return {buffer, mime: String(metadata.content_type || file.content_type || res.headers.get('content-type') || '').split(';')[0].toLowerCase()};
    }
  }
}
