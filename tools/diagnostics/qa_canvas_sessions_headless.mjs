// QA-only real-browser regression: Canvas login and controlled Rails FK exception.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const base = process.env.QA_CANVAS_URL || 'https://localhost:8443';
const forced = process.env.QA_INJECT_FK === '1';
const screenshotDir = process.env.QA_SCREENSHOT_DIR || process.cwd() + '/logs/qa-headless';
const label = process.env.QA_EVIDENCE_PREFIX || (forced ? 'forced-fk' : 'normal');
if (!process.env.QA_LOGIN_USER || !process.env.QA_LOGIN_PASSWORD) throw Error('Se requieren QA_LOGIN_USER y QA_LOGIN_PASSWORD para la cuenta sintética de QA.');
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(new URL('/login/canvas', base).href, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="pseudonym_session[unique_id]"]').fill(process.env.QA_LOGIN_USER);
  await page.locator('input[name="pseudonym_session[password]"]').fill(process.env.QA_LOGIN_PASSWORD);
  if (forced) {
    await page.route('**/login/canvas', async route => {
      const headers = { ...route.request().headers(), 'x-qa-fk': '1' };
      await route.continue({ headers });
    });
  }
  const [post] = await Promise.all([
    page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/login/canvas')),
    page.locator('#login_form input[type="submit"], #login_form button[type="submit"]').first().click()
  ]);
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  const html = await page.content();
  const scenario = process.env.QA_SCENARIO || 'reload';
  if (!['login_only', 'reload', 'parallel_tabs', 'clear_cookies', 'tampered_cookie', 'idle'].includes(scenario)) throw Error('Escenario QA_SCENARIO desconocido.');
  const checks = {
    login_302: post.status() === 302,
    login_no_fk: !html.includes('PG::ForeignKeyViolation') && !html.includes('ActiveRecord::InvalidForeignKey')
  };
  if (post.status() === 302 && scenario !== 'login_only') {
    const initial = await page.goto(base + '/courses/1', {waitUntil:'domcontentloaded'});
    checks.initial_course_200 = initial.status() === 200;
    if (scenario === 'reload') {
      for (let i=0;i<4;i++) { const r=await page.reload({waitUntil:'domcontentloaded'}); checks['reload_'+i+'_200']=r.status()===200; }
    } else if (scenario === 'parallel_tabs') {
      const other=await context.newPage(); const r=await other.goto(base+'/courses/1', {waitUntil:'domcontentloaded'});
      checks.second_tab_200 = r.status() === 200;
      const again=await page.reload({waitUntil:'domcontentloaded'});
      checks.first_tab_still_200 = again.status() === 200;
    } else if (scenario === 'clear_cookies' || scenario === 'tampered_cookie') {
      if (scenario === 'clear_cookies') await context.clearCookies();
      else {
        const cookies=await context.cookies(base);
        console.log('QA_SESSION_COOKIE_AVAILABLE', cookies.some(c=>c.name===(process.env.QA_SESSION_COOKIE || '_normandy_session')));
        const session=cookies.find(c=>c.name===(process.env.QA_SESSION_COOKIE || '_normandy_session'));
        checks.session_cookie_detected=Boolean(session);
        if (session) await context.addCookies([{...session,value:'invalid-session-from-headless-test'}]);
      }
      const r=await page.goto(base+'/courses/1', {waitUntil:'domcontentloaded'});
      checks.session_revoked_redirects_to_login = page.url().includes('/login') || r.status() === 401;
      await page.goto(base+'/login/canvas', {waitUntil:'domcontentloaded'});
      await page.locator('input[name="pseudonym_session[unique_id]"]').fill(process.env.QA_LOGIN_USER);
      await page.locator('input[name="pseudonym_session[password]"]').fill(process.env.QA_LOGIN_PASSWORD);
      const [again] = await Promise.all([page.waitForResponse(r=>r.request().method()==='POST' && r.url().includes('/login/canvas')), page.locator('#login_form input[type="submit"]').first().click()]);
      checks.reauthentication_302 = again.status() === 302;
      checks.reauthentication_no_fk = again.status()===302 ? true : !((await again.text()).includes('PG::ForeignKeyViolation'));
    } else if (scenario === 'idle') {
      await page.waitForTimeout(12000);
      const r=await page.reload({waitUntil:'domcontentloaded'});
      checks.short_idle_keeps_session = r.status() === 200;
    }
  }
  console.log('QA_SESSION_CHECKS '+JSON.stringify({scenario,checks}));
  if (Object.values(checks).some(ok=>!ok)) process.exitCode=5;
  const report = {
    mode: label,
    httpPostStatus: post.status(),
    activeRecordForeignKey: html.includes('ActiveRecord::InvalidForeignKey'),
    pgForeignKeyViolation: html.includes('PG::ForeignKeyViolation'),
    termsOfService: html.includes('terms_of_services'),
    constraintMatches: html.includes('fk_rails_337ba633a9'),
    loginControllerMatches: html.includes('Login::CanvasController#create'),
    actualUrl: page.url()
  };
  const filePath = `${screenshotDir}/canvas-login-${label}.png`;
  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(JSON.stringify({ ...report, screenshot: filePath }, null, 2));
  if (forced && !(report.httpPostStatus === 500 && report.activeRecordForeignKey && report.pgForeignKeyViolation && report.constraintMatches && report.loginControllerMatches)) process.exitCode = 2;
  if (!forced && !(report.httpPostStatus === 302 && !report.activeRecordForeignKey)) process.exitCode = 3;
} finally {
  await browser.close();
}
