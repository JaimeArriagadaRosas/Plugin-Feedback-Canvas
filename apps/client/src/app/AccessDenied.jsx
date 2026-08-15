import { useState, useEffect } from 'react';
import { api } from '@/api';
import { isIframe, setToken } from '@/lib/authToken';
import logger from '../utils/logger';

const log = {
  info: (msg, payload) => logger.info('AccessDenied', msg, payload),
  error: (msg, payload) => logger.error('AccessDenied', msg, payload),
};

export default function AccessDenied({ apiError }) {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tokenStatus, setTokenStatus] = useState('Verifying...');

  useEffect(() => {
    async function checkToken() {
      try {
        if (document.hasStorageAccess) {
          const hasAccess = await document.hasStorageAccess();
          if (!hasAccess) {
            setTokenStatus('⚠️ No storage access (iframe). Enable third-party cookies.');
            return;
          }
        }
        const token = localStorage.getItem('lti_token');
        setTokenStatus(token ? `✅ Exists (${token.length} chars)` : '❌ Does not exist');
      } catch {
        setTokenStatus('⚠️ Blocked (third-party cookies). Open the plugin in a new tab.');
      }
    }
    checkToken();
  }, []);

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLocalError(null);
    try {
      const response = await api.post('/auth/local-login', { email, password });
      if (response.success && response.devToken) {
        setToken(response.devToken);
        log.info('Local login successful. Reloading...');
        window.location.reload();
      } else {
        setLocalError('Invalid credentials');
      }
    } catch (e) {
      log.error('Error in local login:', { message: e.message });
      setLocalError(e.response?.data?.error || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '60px 40px', fontFamily: "'Lato', sans-serif", textAlign: 'center', background: '#fdfefe', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '640px', background: '#ffffff', border: '1px solid #c7cdd1', borderRadius: '8px', padding: '40px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
        <h2 style={{ color: '#c0392b', fontSize: '24px', fontWeight: '700', margin: '0 0 10px 0' }}>
          LTI Access Restricted
        </h2>
        <p style={{ color: '#2d3b45', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0' }}>
          No valid LTI session was detected, or there was a temporary connection issue.
        </p>

        <div style={{ marginBottom: '25px' }}>
          <button
            onClick={() => {
              log.info('User requested LTI connection retry');
              window.location.reload();
            }}
            style={{
              background: '#0770a3',
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '4px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🔄 Retry LTI Connection / Refresh Session
          </button>
        </div>

        {/* Debugging information panel */}
        <div style={{ padding: '12px 16px', background: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', textAlign: 'left', marginBottom: '20px', fontFamily: 'monospace' }}>
          <strong>ℹ️ DIAGNOSTICS:</strong><br />
          API Error: {apiError || 'No API error reported'}<br />
          Current URL: {window.location.href}<br />
          Token in LocalStorage: {tokenStatus}<br />
          Cookie LTI: {(() => {
            try {
              return document.cookie.includes('lti_token') ? '✅ Present' : '❌ Absent';
            } catch {
              return '⚠️ Blocked';
            }
          })()}<br />
          Environment: {import.meta.env.DEV ? 'Development (DEV)' : 'Production'}
        </div>

        {localError && (
          <div style={{ padding: '10px', background: '#fde8e8', border: '1px solid #c0392b', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#c0392b', textAlign: 'left' }}>
            ⚠️ {localError}
          </div>
        )}

        {/* Local login form — ONLY visible in Development and OUTSIDE an iframe */}
        {import.meta.env.DEV && !isIframe && (
          <div style={{ marginTop: '30px', borderTop: '2px dashed #c7cdd1', paddingTop: '30px', background: '#f0f7ff', borderRadius: '6px', padding: '20px' }}>
            <h3 style={{ color: '#0770a3', fontSize: '16px', margin: '0 0 10px 0', fontWeight: '700' }}>
              🖥️ LOCAL ENVIRONMENT DETECTED
            </h3>
            <p style={{ fontSize: '13px', color: '#444', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              Enter your local credentials to continue:
            </p>
            <form onSubmit={handleLocalLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '320px', margin: '0 auto' }}>
              <input
                type="email"
                placeholder="Email (e.g.: teacher@canvas.local)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '4px', border: '1px solid #c7cdd1', fontSize: '14px' }}
              />
              <input
                type="password"
                placeholder="Password (e.g.: password123)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '4px', border: '1px solid #c7cdd1', fontSize: '14px' }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{ background: '#0770a3', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '12px' }}>
              Test accounts: teacher@canvas.local, student1@canvas.local, admin@canvas.local (password: password123)
            </p>
          </div>
        )}

        {/* Security message for iframes */}
        {isIframe && (
          <div style={{ marginTop: '30px', padding: '15px', background: '#f8f9fa', borderLeft: '4px solid #e74c3c', borderRadius: '4px', textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#555', lineHeight: '1.5' }}>
              <strong>🔒 LTI Security:</strong> This session has been blocked. For security reasons, manual access and role simulation are not allowed when the plugin runs embedded within the LMS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
