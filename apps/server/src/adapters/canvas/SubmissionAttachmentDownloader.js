import { DomainError } from '../../utils/errors.js';

const MAX_BYTES = 12 * 1024 * 1024;
const isTrusted = (url, canvasOrigin) => {
  if (url.username || url.password || url.port && url.origin !== canvasOrigin.origin) return false;
  if (url.origin === canvasOrigin.origin) return true;
  if (url.protocol !== 'https:') return false;
  const h = url.hostname.toLowerCase();
  return h.endsWith('.amazonaws.com') || h.endsWith('.instructure.com') || h.endsWith('.cloudfront.net');
};

export default class SubmissionAttachmentDownloader {
  constructor(adapter) { this.adapter = adapter; }
  async download(file, teacherId) {
    if (!file?.id) throw new DomainError('Archivo sin identificador de Canvas', 422);
    const meta = await this.adapter._fetchWithToken('/files/' + encodeURIComponent(String(file.id)), teacherId);
    if (!meta?.url) throw new DomainError('Canvas no proporcionó URL de descarga', 422);
    const canvasOrigin = new URL(this.adapter.httpClient.canvasBaseUrl);
    let url = new URL(meta.url, canvasOrigin);
    let response;
    for (let i = 0; i < 4; i++) {
      if (!isTrusted(url, canvasOrigin)) throw new DomainError('Origen de descarga de adjunto no autorizado', 422);
      response = await fetch(url, { redirect:'manual', signal:AbortSignal.timeout(15000) });
      if (![301,302,303,307,308].includes(response.status)) break;
      const destination = response.headers.get('location');
      if (!destination) throw new DomainError('Redirección sin destino', 502);
      url = new URL(destination, url);
      if (i === 3) throw new DomainError('Demasiadas redirecciones de adjunto', 502);
    }
    if (!response.ok) throw new DomainError('Descarga rechazada por Canvas', 502);
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new DomainError('Archivo excede 12 MiB', 413);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) throw new DomainError('Archivo excede 12 MiB', 413);
    return {
      buffer,
      mime: String(meta.content_type || file.content_type || response.headers.get('content-type') || '').split(';')[0].toLowerCase()
    };
  }
}
