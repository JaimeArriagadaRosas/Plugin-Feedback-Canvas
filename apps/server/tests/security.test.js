import { describe, it, expect, vi } from 'vitest';
import FileController from '../src/controllers/FileController.js';
import * as TlsProxy from '../../installer/src/local/TlsProxyServer.js';
import { REQUIRED_CANVAS_SCOPES } from '../src/constants/canvasScopes.js';
import fs from 'fs';

describe('Targeted Security Tests', () => {
  describe('FileController URL redirection', () => {
    it('should follow 301/302/303/307/308 redirects', async () => {
      const controller = new FileController({});
      let fetchCount = 0;
      
      controller._fetch = vi.fn().mockImplementation((url, context) => {
        fetchCount++;
        if (fetchCount === 1) {
          return Promise.resolve({
            status: 301,
            headers: new Headers({ location: 'http://canvas.docker/test' })
          });
        }
        if (fetchCount === 2) {
          return Promise.resolve({
            status: 308,
            headers: new Headers({ location: 'http://canvas.docker/final' })
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
          headers: new Headers(),
          json: () => Promise.resolve({ url: 'http://canvas.docker/final-file' })
        });
      });

      await controller._downloadFile('http://canvas.docker/start', { url: 'http://canvas.docker', headers: {} });
      expect(fetchCount).toBe(3);
    });

    it('should resolve relative Location headers', async () => {
      const controller = new FileController({});
      let fetchCount = 0;
      let lastUrl = '';
      
      controller._fetch = vi.fn().mockImplementation((url, context) => {
        fetchCount++;
        lastUrl = url;
        if (fetchCount === 1) {
          return Promise.resolve({
            status: 302,
            headers: new Headers({ location: '/relative/path' })
          });
        }
        return Promise.resolve({ status: 200, ok: true, headers: new Headers(), arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)), json: () => Promise.resolve({ url }) });
      });

      await controller._downloadFile('http://canvas.docker/start', { url: 'http://canvas.docker', headers: {} });
      expect(lastUrl).toBe('http://canvas.docker/relative/path');
    });

    it('should throw on max redirect limit', async () => {
      const controller = new FileController({});
      
      controller._fetch = vi.fn().mockImplementation((url, context) => {
        return Promise.resolve({
          status: 302,
          headers: new Headers({ location: 'http://canvas.docker/loop' })
        });
      });

      await expect(controller._downloadFile('http://canvas.docker/start', { url: 'http://canvas.docker', headers: {} }))
        .rejects.toThrow('Maximum redirect limit reached');
    });

    it('should strip cross-origin Authorization and Host headers', async () => {
      const controller = new FileController({});
      let lastHeaders = {};
      
      controller._fetch = vi.fn().mockImplementation((url, context) => {
        lastHeaders = context.headers;
        return Promise.resolve({ status: 200, ok: true, headers: new Headers(), arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)), json: () => Promise.resolve({ url }) });
      });

      await controller._downloadFile('http://external.site/start', { 
        url: 'http://canvas.docker', 
        headers: { Authorization: 'Bearer token', host: 'canvas.docker', 'X-Keep': 'keep' } 
      });
      
      expect(lastHeaders.Authorization).toBeUndefined();
      expect(lastHeaders.host).toBeUndefined();
      expect(lastHeaders['X-Keep']).toBe('keep');
    });

    it('should preserve signed-query (sf_verifier)', async () => {
      const controller = new FileController({});
      let lastUrl = '';
      
      controller._fetch = vi.fn().mockImplementation((url, context) => {
        lastUrl = url;
        if (url === 'http://canvas.docker/start?sf_verifier=secret123') {
          return Promise.resolve({
            status: 302,
            headers: new Headers({ location: 'http://canvas.docker/next' })
          });
        }
        return Promise.resolve({ status: 200, ok: true, headers: new Headers(), arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)), json: () => Promise.resolve({ url }) });
      });

      await controller._downloadFile('http://canvas.docker/start?sf_verifier=secret123', { url: 'http://canvas.docker', headers: {} });
      expect(lastUrl).toBe('http://canvas.docker/next?sf_verifier=secret123');
    });
  });

  describe('TlsProxyServer origin rewriting', () => {
    it('should rewrite valid canvas origin', () => {
      global.process.env.CANVAS_LMS_HOST = 'canvas.docker';
      global.process.env.TLS_LISTEN_PORT = '8443';
      const reqHeaders = { 'location': 'http://canvas.docker/auth' };
      const resHeaders = TlsProxy.rewriteLocationHeader(reqHeaders, '/api/lti/');
      
      expect(resHeaders.location.startsWith('https://localhost:8443')).toBe(true);
    });

    it('should NOT rewrite malicious/query-substring origins', () => {
      global.process.env.CANVAS_LMS_HOST = 'canvas.docker';
      global.process.env.TLS_LISTEN_PORT = '8443';
      const reqHeaders = { 'location': 'http://attacker.com/auth' };
      const resHeaders = TlsProxy.rewriteLocationHeader(reqHeaders, '/api/lti/?return_to=http://canvas.docker');
      
      expect(resHeaders.location).toBe('http://attacker.com/auth');
    });
  });

  describe('REQUIRED_CANVAS_SCOPES consumption', () => {
    it('should have required scopes defined', () => {
      expect(REQUIRED_CANVAS_SCOPES).toBeInstanceOf(Array);
      expect(REQUIRED_CANVAS_SCOPES.length).toBeGreaterThan(0);
    });

    it('installer LtiRubyScriptTemplate should use REQUIRED_CANVAS_SCOPES', () => {
      const templateContent = fs.readFileSync('apps/installer/src/local/LtiRubyScriptTemplate.js', 'utf-8');
      expect(templateContent).toContain('REQUIRED_CANVAS_SCOPES.map');
    });
    
    it('oauth should use REQUIRED_CANVAS_SCOPES', () => {
      const oauthContent = fs.readFileSync('apps/server/src/controllers/CanvasOAuthController.js', 'utf-8');
      expect(oauthContent).toContain('REQUIRED_CANVAS_SCOPES');
    });
  });
});
