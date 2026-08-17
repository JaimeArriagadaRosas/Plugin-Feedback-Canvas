import { describe, it, expect, vi } from 'vitest';
import { requireCanvasOAuth } from '../../src/middlewares/CanvasOAuthMiddleware.js';

describe('CanvasOAuthMiddleware', () => {
  it('TEST A: valid LTI/session identity + no Canvas OAuth token -> HTTP 401 requireOAuth=true oauthUrl present', async () => {
    // Mock req
    const req = {
      appIdentity: { ltiUserId: '030d27cb-aade-42ee-a407-7e9677fb2a60' }
    };

    // Mock res
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    const next = vi.fn();

    // Mock CanvasTokenManager that throws AppError with data.requireOAuth = true
    const canvasTokenManager = {
      getValidToken: vi.fn().mockRejectedValue({
        name: 'AppError',
        statusCode: 401,
        data: { requireOAuth: true },
        message: 'OAuth token not found for user 030d27cb-aade-42ee-a407-7e9677fb2a60'
      })
    };

    const middleware = requireCanvasOAuth(canvasTokenManager);
    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      exito: false,
      error: {
        codigo: 401,
        mensaje: 'Missing authorization for Canvas API',
        requireOAuth: true,
        oauthUrl: '/api/oauth2/canvas/login'
      }
    });
  });

  it('TEST D: valid Canvas OAuth token for LTI sub -> req.canvasToken is populated -> continues normally', async () => {
    // Mock req
    const req = {
      appIdentity: { ltiUserId: '030d27cb-aade-42ee-a407-7e9677fb2a60' }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    const next = vi.fn();

    // Mock CanvasTokenManager that successfully returns a token
    const canvasTokenManager = {
      getValidToken: vi.fn().mockResolvedValue('valid_oauth_token_123')
    };

    const middleware = requireCanvasOAuth(canvasTokenManager);
    await middleware(req, res, next);

    expect(req.canvasToken).toBe('valid_oauth_token_123');
    expect(next).toHaveBeenCalledWith(); // Called without error
    expect(res.status).not.toHaveBeenCalled();
  });
});
