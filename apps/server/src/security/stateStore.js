import { isHttpsEnabled, isProduction } from './envGuard.js';

/**
 * Stores the temporary LTI 1.3 state in a cookie (or DB in the future).
 * Extracted per SRP (Single Responsibility Principle).
 */
export function storeLtiState(res, state, launchData) {
  const isProd = isProduction();
  const cookieSecure = isProd || isHttpsEnabled();
  const cookieSameSite = cookieSecure ? 'None' : 'Lax';
  
  res.cookie(`lti_${state}`, JSON.stringify(launchData), { 
    httpOnly: true, 
    secure: cookieSecure, 
    sameSite: cookieSameSite, 
    partitioned: cookieSecure,
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
}

/**
 * Consumes (reads and deletes) the temporary LTI 1.3 state from the cookies.
 */
export function consumeLtiState(req, res, state) {
  if (!state) return null;
  const launchCookieStr = req.cookies?.[`lti_${state}`];
  if (launchCookieStr) {
    try {
      res.clearCookie(`lti_${state}`);
      return JSON.parse(launchCookieStr);
    } catch(e) {
      return null;
    }
  }
  return null;
}
