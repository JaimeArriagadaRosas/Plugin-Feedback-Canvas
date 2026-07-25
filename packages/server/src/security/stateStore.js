import { isHttpsEnabled, isProduction } from './envGuard.js';

/**
 * Almacena el state temporal de LTI 1.3 en una cookie (o BD a futuro).
 * Extraído por SRP (Single Responsibility Principle).
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
    maxAge: 15 * 60 * 1000 // 15 minutos
  });
}

/**
 * Consume (lee y elimina) el state temporal de LTI 1.3 desde las cookies.
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
