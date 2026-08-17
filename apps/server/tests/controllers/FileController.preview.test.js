import { describe, it, expect, vi, beforeEach } from 'vitest';
import FileController from '../../src/controllers/FileController.js';
import * as redact from '../../src/security/redact.js';

describe('FileController Preview Contract', () => {
  let fileController;
  let mockRes;
  let mockReq;

  beforeEach(() => {
    fileController = new FileController({});
    fileController._gotenbergEndpoint = vi.fn().mockReturnValue('http://gotenberg:3000/forms/libreoffice/convert');
    fileController._canvasHost = vi.fn().mockReturnValue('canvas.docker');

    // We override native fetch for controlled responses
    global.fetch = vi.fn();

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
      setHeader: vi.fn(),
    };

    mockReq = {
      query: { url: 'http://canvas.docker/files/123/download' },
      canvasToken: 'mock_token',
      appIdentity: { canonicalUserId: 1 }
    };
  });

  const mockFetchSuccess = (buffer, contentType) => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': contentType }),
      arrayBuffer: async () => buffer
    });
  };

  const mockApiSuccess = (downloadUrl) => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ url: downloadUrl })
    });
  };

  it('PDF válido con OAuth de usuario', async () => {
    mockApiSuccess('http://canvas.docker/files/123/download?token=actual');
    mockFetchSuccess(Buffer.from('pdf_data'), 'application/pdf');

    await fileController.preview(mockReq, mockRes);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(mockRes.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it('DOCX válido + Gotenberg', async () => {
    mockReq.query.url = 'http://canvas.docker/files/123/download?file=doc.docx';
    mockApiSuccess('http://canvas.docker/files/123/download?token=actual');
    mockFetchSuccess(Buffer.from('docx_data'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); // file fetch
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200 }); // healthcheck
    mockFetchSuccess(Buffer.from('pdf_data'), 'application/pdf'); // gotenberg

    await fileController.preview(mockReq, mockRes);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(mockRes.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it('XLSX válido + Gotenberg', async () => {
    mockReq.query.url = 'http://canvas.docker/files/123/download?file=doc.xlsx';
    mockApiSuccess('http://canvas.docker/files/123/download?token=actual');
    mockFetchSuccess(Buffer.from('xlsx_data'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200 }); // healthcheck
    mockFetchSuccess(Buffer.from('pdf_converted'), 'application/pdf');

    await fileController.preview(mockReq, mockRes);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
  });

  it('PPTX válido + Gotenberg', async () => {
    mockReq.query.url = 'http://canvas.docker/files/123/download?file=doc.pptx';
    mockApiSuccess('http://canvas.docker/files/123/download?token=actual');
    mockFetchSuccess(Buffer.from('pptx_data'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200 }); // healthcheck
    mockFetchSuccess(Buffer.from('pdf_converted'), 'application/pdf');

    await fileController.preview(mockReq, mockRes);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
  });

  it('Token OAuth inexistente -> No falla validación local, pero puede fallar Canvas API si requiere auth', async () => {
    mockReq.canvasToken = undefined;
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    });
    await fileController.preview(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_CANVAS' }));
  });

  it('Canvas File API devuelve 401', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    });
    await fileController.preview(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_CANVAS' }));
  });

  it('Fallo durante descarga desde Canvas', async () => {
    mockApiSuccess('http://canvas.docker/files/123/download?token=actual');
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });
    await fileController.preview(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(502);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CANVAS_FILE_DOWNLOAD' }));
  });

  it('Gotenberg inaccesible (Healthcheck falla por red)', async () => {
    mockReq.query.url = 'http://canvas.docker/files/123/download?file=doc.docx';
    mockApiSuccess('http://canvas.docker/files/123/download?token=actual');
    mockFetchSuccess(Buffer.from('docx_data'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); // file fetch
    global.fetch.mockRejectedValueOnce(new Error('Network disconnected')); // healthcheck fails

    await fileController.preview(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'GOTENBERG_UNAVAILABLE' }));
  });

  it('Gotenberg devuelve != 200 en healthcheck', async () => {
    mockReq.query.url = 'http://canvas.docker/files/123/download?file=doc.docx';
    mockApiSuccess('http://canvas.docker/files/123/download?token=actual');
    mockFetchSuccess(Buffer.from('docx_data'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); // file fetch
    global.fetch.mockResolvedValueOnce({ ok: false, status: 503 }); // healthcheck fails

    await fileController.preview(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'GOTENBERG_UNAVAILABLE' }));
  });

  it('Gotenberg devuelve 5xx durante la conversión (sano en healthcheck)', async () => {
    mockReq.query.url = 'http://canvas.docker/files/123/download?file=doc.docx';
    mockApiSuccess('http://canvas.docker/files/123/download?token=actual');
    mockFetchSuccess(Buffer.from('docx_data'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); // file fetch
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200 }); // healthcheck OK
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    await fileController.preview(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(502);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'GOTENBERG_CONVERSION' }));
  });

  it('Archivo superior a 25 MB', async () => {
    mockApiSuccess('http://canvas.docker/files/123/download?token=actual');
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024); // 26 MB
    mockFetchSuccess(largeBuffer, 'application/pdf');

    await fileController.preview(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(413);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FILE_TOO_LARGE' }));
  });

  it('Host/protocolo no permitido', async () => {
    mockReq.query.url = 'ftp://malicious.com/file';
    await fileController.preview(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_FILE_URL' }));

    mockReq.query.url = 'http://malicious.com/file';
    await fileController.preview(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_FILE_URL' }));
  });

  it('Elimina Authorization header si downloadUrl es cross-origin', async () => {
    mockReq.query.url = 'http://canvas.docker/files/123/download?file=doc.pdf';
    mockReq.canvasToken = 'CANVAS_BEARER';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://s3.amazonaws.com/canvas/doc.pdf?Signature=XYZ' })
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/pdf' },
      arrayBuffer: async () => Buffer.from('pdf_data')
    });

    await fileController.preview(mockReq, mockRes);

    const fileFetchCall = global.fetch.mock.calls[1];
    expect(fileFetchCall[0]).toBe('https://s3.amazonaws.com/canvas/doc.pdf?Signature=XYZ');
    expect(fileFetchCall[1].headers).not.toHaveProperty('Authorization');
    expect(fileFetchCall[1].headers).not.toHaveProperty('authorization');
    expect(mockRes.status).not.toHaveBeenCalledWith(500);
    expect(mockRes.send).toHaveBeenCalled();
  });

  it('Conserva Authorization header si downloadUrl es same-origin', async () => {
    mockReq.query.url = 'http://canvas.docker/files/123/download?file=doc.pdf';
    mockReq.canvasToken = 'CANVAS_BEARER';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://canvas.docker/files/actual/doc.pdf' })
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/pdf' },
      arrayBuffer: async () => Buffer.from('pdf_data')
    });

    await fileController.preview(mockReq, mockRes);

    const fileFetchCall = global.fetch.mock.calls[1];
    expect(fileFetchCall[0]).toBe('http://canvas.docker/files/actual/doc.pdf');
    expect(fileFetchCall[1].headers).toHaveProperty('Authorization', 'Bearer CANVAS_BEARER');
  });

  it('Secretos redactados ante errores', () => {
    const dirtyUrl = 'http://canvas.docker/files/123/download?code=SUPER_SECRET&state=ABC';
    const cleanUrl = redact.redactSensitiveStrings(dirtyUrl);
    expect(cleanUrl).not.toContain('SUPER_SECRET');
    expect(cleanUrl).toContain('[REDACTED]');
  });
});
