import { describe, it, expect, vi, beforeEach } from 'vitest';
import FileController from '../../src/controllers/FileController.js';

describe('FileController Identity Contract', () => {
  let fileController;
  let mockRes;

  beforeEach(() => {
    fileController = new FileController({});

    // Stub methods to prevent actual network/conversion
    vi.spyOn(fileController, '_validateUrl').mockReturnValue(new URL('http://canvas.docker/files/123/download'));
    vi.spyOn(fileController, '_prepareRequest').mockImplementation((url, headers) => ({ url: url.toString(), headers }));
    vi.spyOn(fileController, '_resolveDownloadUrl').mockResolvedValue('http://canvas.docker/download');
    vi.spyOn(fileController, '_downloadFile').mockResolvedValue({ buffer: Buffer.from('test'), contentType: 'application/pdf' });
    vi.spyOn(fileController, '_respondWithPreview').mockResolvedValue(true);

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn()
    };
  });

  it('debe consumir req.canvasToken en los headers en lugar de buscar canonicalUserId', async () => {
    const req = {
      query: { url: 'http://canvas.docker/files/123/download' },
      canvasToken: 'VALID_OAUTH_TOKEN_SUB_BASED',
      appIdentity: {
        canonicalUserId: 9999 // ID numérico que NO debe ser usado para buscar tokens
      }
    };

    await fileController.preview(req, mockRes);

    expect(fileController._prepareRequest).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ Authorization: 'Bearer VALID_OAUTH_TOKEN_SUB_BASED' })
    );
  });

  it('should not inject Authorization if req.canvasToken is undefined, and should not fail searching in TokenManager', async () => {
    const req = {
      query: { url: 'http://canvas.docker/files/123/download' },
      // canvasToken no existe
      appIdentity: {
        canonicalUserId: 9999
      }
    };

    await fileController.preview(req, mockRes);

    expect(fileController._prepareRequest).toHaveBeenCalledWith(
      expect.any(URL),
      expect.not.objectContaining({ Authorization: expect.any(String) })
    );
  });
});
