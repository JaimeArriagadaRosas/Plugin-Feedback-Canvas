import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from '../../src/api/index.js';

describe('ApiClient global interceptor', () => {
  const originalFetch = global.fetch;
  const originalLocation = global.window;

  beforeEach(() => {
    // Reset redirecting flag implicitly by resetting module state if possible,
    // or we just mock fetch.
    global.window = { location: { href: '' } };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.window = originalLocation;
    vi.restoreAllMocks();
  });

  it('TEST B: frontend receives requireOAuth=true -> chooses Canvas OAuth flow -> does NOT throw ApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({
        exito: false,
        error: {
          codigo: 401,
          mensaje: 'Missing authorization for Canvas API',
          requireOAuth: true,
          oauthUrl: '/api/oauth2/canvas/login'
        }
      }))
    });

    // When requireOAuth is true, apiFetch returns a never-resolving promise (hanging)
    // so the UI stays in loading state while the browser redirects.
    // We can test this by checking if window.location.href changes
    // and verifying it doesn't throw.

    // Because it hangs, we can race it with a timeout to prove it doesn't reject.
    const fetchPromise = apiFetch('/courses');
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 50));

    const result = await Promise.race([fetchPromise, timeoutPromise]);

    expect(result).toBe('TIMEOUT'); // It hung, did not throw ApiError
    expect(global.window.location.href).toBe('/api/oauth2/canvas/login');
  });

  it('TEST C: actually invalid LTI/session -> throws ApiError appropriately', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({
        exito: false,
        error: {
          codigo: 401,
          mensaje: 'Invalid session'
        }
      }))
    });

    // Should throw ApiError which then causes useCourseData to show "Invalid or expired LTI session"
    await expect(apiFetch('/courses')).rejects.toThrow(ApiError);
    await expect(apiFetch('/courses')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid session'
    });
    
    // Should NOT redirect
    expect(global.window.location.href).toBe('');
  });
});
