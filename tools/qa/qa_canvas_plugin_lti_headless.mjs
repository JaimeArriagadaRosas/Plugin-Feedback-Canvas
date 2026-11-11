// Real LTI 1.3 Canvas → Plugin Feedback QA smoke. Headless only.
// Outputs booleans and HTTP status codes, never credentials, URLs with tokens or JWTs.
import { chromium } from '@playwright/test';

for (const name of ['QA_ALLOW_FULL_LTI_E2E','PLUGIN_TEST_MODE','PLUGIN_QA_NO_BROWSER']) {
  if (process.env[name] !== 'true') throw new Error('Missing explicit isolated QA opt-in');
}
const base = process.env.QA_CANVAS_URL;
const user = process.env.QA_LOGIN_USER;
const password = process.env.QA_LOGIN_PASSWORD;
if (!base || !(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base) || base === 'https://localhost:8443') || !user || !password) {
  throw new Error('Only localhost Canvas QA and synthetic account are authorized');
}
const report = {
  mode: 'headless_real_canvas_plugin',
  canvasLoginPostStatus: null,
  loginSucceeded: false,
  feedbackTabVisible: false,
  toolIframeVisible: false,
  pluginUiVisible: false,
  callbackHttpStatuses: [],
  ltiLoginHttpStatuses: [],
  blankIframe: false,
  fkExceptionFound: false,
  iframeRouteClasses: [],
  iframeHasBody: false,
  iframeContainsAuthFailure: false,
  iframeContainsRuntimeFailure: false,
  iframeHasRoot: false,
  pluginApiFailures: [],
  coursesHttpStatuses: [],
  coursesHttpAfterOauthStatuses: [],
  oauthCallbackHttpStatuses: [],
  courseApiSucceeded: false,
  oauthCallbackSucceeded: false,
  oauthFailureClass: null,
  oauthErrorCodeClass: null,
};
// Only fixed categories leave the browser; never serialize HTTP bodies or OAuth URLs.
function classifyOauthFailure(raw) {
  if (/CANVAS_CLIENT_SECRET|LTI_CLIENT_SECRET|configuraci[oó]n incompleta/i.test(raw)) return 'missing_client_secret';
  if (/Fallo al obtener token|oauth.*token|token.*Canvas/i.test(raw)) return 'token_exchange';
  if (/fetch failed|CANVAS_CONNECTION_FAILED|conexi[oó]n|ECONNREFUSED/i.test(raw)) return 'canvas_connection';
  if (/Estado OAuth|OAuth inv[aá]lido/i.test(raw)) return 'oauth_state';
  if (/postgres|database|saveToken|persisten|invalid input syntax/i.test(raw)) return 'token_persistence';
  if (/Error interno del servidor|Internal Server Error/i.test(raw)) return 'masked_internal_error';
  return 'unclassified_failure';
}
const oauthResponseChecks = [];
let oauthCallbackSucceeded = false;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('response', (response) => {
    const { pathname } = new URL(response.url());
    if (pathname === '/api/lti/callback') {
      report.callbackHttpStatuses.push(response.status());
      if (response.status() === 302) {
        try {
          const where = new URL(response.headers()['location'], response.url());
          report.callbackRedirectPort = where.port || 'default';
          report.callbackRedirectHostClass = where.hostname === 'localhost' ? 'localhost' :
            where.hostname === '127.0.0.1' ? 'loopback' : 'other';
          report.callbackRedirectPath = where.pathname.slice(0,70);
          // Query-string intentionally omitted: it contains authentication tokens.
        } catch {}
      }
    }
    if (response.status() >= 400 && new URL(response.url()).port === '3000') {
      report.pluginApiFailures.push({path:pathname.slice(0,90),status:response.status()});
    }
    if (pathname === '/api/lti/login') report.ltiLoginHttpStatuses.push(response.status());
    if (pathname === '/api/oauth2/canvas/callback') {
      report.oauthCallbackHttpStatuses.push(response.status());
      if (response.status() === 302) {
        oauthCallbackSucceeded = true;
        report.oauthCallbackSucceeded = true;
      }
    }
    if (pathname === '/api/courses') {
      report.coursesHttpStatuses.push(response.status());
      if (oauthCallbackSucceeded) {
        report.coursesHttpAfterOauthStatuses.push(response.status());
        if (response.status() === 200) report.courseApiSucceeded = true;
      }
    }
    if (pathname === '/api/oauth2/canvas/callback' && response.status() >= 400) {
      oauthResponseChecks.push(response.json().then(payload => {
        const message = String(payload?.error?.mensaje || '');
        report.oauthFailureClass = classifyOauthFailure(message);
        const code = String(payload?.error?.codigoError || '');
        report.oauthErrorCodeClass = /^[A-Z][A-Z_]{1,60}$/.test(code) ? code : 'UNCLASSIFIED_CODE';
      }).catch(() => { report.oauthFailureClass = 'non_json_response'; }));
    }
  });
  await page.goto(new URL('/login/canvas', base).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('input[name="pseudonym_session[unique_id]"]').fill(user);
  await page.locator('input[name="pseudonym_session[password]"]').fill(password);
  const [post] = await Promise.all([
    page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/login/canvas'), { timeout: 40000 }),
    page.locator('#login_form input[type="submit"], #login_form button[type="submit"]').first().click()
  ]);
  report.canvasLoginPostStatus = post.status();
  report.loginSucceeded = post.status() === 302;
  if (report.loginSucceeded) {
    await page.goto(new URL('/courses/1', base).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const feedback = page.locator('#section-tabs a').filter({hasText:/Feedback/i}).first();
    report.feedbackTabVisible = await feedback.isVisible().catch(() => false);
    if (report.feedbackTabVisible) {
      await feedback.click();
      await page.waitForTimeout(10000);
      const tool = page.locator('iframe[name^="tool_content"]').first();
      report.toolIframeVisible = await tool.isVisible().catch(() => false);
      if (report.toolIframeVisible) {
        const frame = page.frameLocator('iframe[name^="tool_content"]');
        const consent = frame.getByRole('button', {name:/Authorize|Autorizar/i}).first();
        if (await consent.isVisible().catch(() => false)) {
          await consent.click();
          await page.waitForTimeout(5500);
        }
        await page.waitForTimeout(5000);
        report.iframeRouteClasses = page.frames().map(f => {
          try {
            const u = new URL(f.url());
            const group = u.port === '3000' ? 'plugin' :
                         u.port && base.endsWith(':'+u.port) ? 'canvas' : 'other';
            const host = u.hostname === 'localhost' ? 'localhost' :
              u.hostname === '127.0.0.1' ? 'loopback' : 'other';
            return {group,host,port:u.port || 'default',pathname:u.pathname.slice(0,80)};
          } catch { return {group:'about_blank',pathname:'unknown'}; }
        });
        const body = frame.locator('body').first();
        report.iframeHasBody = await body.isVisible().catch(() => false);
        const bodyText = report.iframeHasBody ? await body.innerText().catch(() => '') : '';
        report.iframeTextLength = bodyText.length;
        report.iframeHasLoginHeading = /sign in|iniciar sesi[oó]n|login/i.test(bodyText);
        report.iframeHasReactError = /application error|client-side exception|uncaught|failed to load/i.test(bodyText);
        report.iframeContainsAuthFailure = /unauthori[sz]ed|not authorized|sesión caducada|acceso denegado|login failed/i.test(bodyText);
        report.iframeContainsRuntimeFailure = /error interno|not found|no encontrado|cannot connect|refused/i.test(bodyText);
        const root = frame.locator('#root, #app').first();
        report.iframeHasRoot = await root.count().then(v => v>0).catch(() => false);
        report.pluginUiVisible = await root.waitFor({state:'visible',timeout:15000}).then(() => true).catch(() => false);
        if (report.pluginUiVisible) {
          const content = await root.innerText().catch(() => '');
          report.blankIframe = content.trim().length === 0;
        }
      }
    }
  }
  const html = await page.content();
  report.fkExceptionFound = /ActiveRecord::InvalidForeignKey|PG::ForeignKeyViolation|fk_rails_337ba633a9/.test(html);
} catch (e) {
  report.errorClass = e?.name || 'BrowserError';
} finally {
  await Promise.allSettled(oauthResponseChecks);
  await browser.close();
}
report.passed = report.loginSucceeded && report.feedbackTabVisible &&
                report.toolIframeVisible && report.pluginUiVisible &&
                report.oauthCallbackSucceeded && report.courseApiSucceeded &&
                !report.blankIframe && !report.fkExceptionFound;
console.log('QA_LTI_E2E_RESULT='+JSON.stringify(report));
if (!report.passed) process.exitCode = 2;
