// QA-only real-browser regression: Canvas login and controlled Rails FK exception.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const base = process.env.QA_CANVAS_URL || 'https://localhost:8443';

const screenshotDir = process.env.QA_SCREENSHOT_DIR || process.cwd() + '/logs/qa-headless';
const label = process.env.QA_EVIDENCE_PREFIX || 'lti-clean';
if (!process.env.QA_LOGIN_USER || !process.env.QA_LOGIN_PASSWORD) throw Error('Se requieren QA_LOGIN_USER y QA_LOGIN_PASSWORD para la cuenta sintética de QA.');
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(new URL('/login/canvas', base).href, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="pseudonym_session[unique_id]"]').fill(process.env.QA_LOGIN_USER);
  await page.locator('input[name="pseudonym_session[password]"]').fill(process.env.QA_LOGIN_PASSWORD);
  const [post] = await Promise.all([
    page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/login/canvas')),
    page.locator('#login_form input[type="submit"], #login_form button[type="submit"]').first().click()
  ]);
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  const html = await page.content();
  const loginSucceeded = post.status() === 302;
  if (loginSucceeded) await page.goto(new URL('/courses/1', base).href, { waitUntil: 'domcontentloaded' });
  const tabs = page.locator('#section-tabs a');
  const tabLabels = (await tabs.allTextContents()).map(text => text.trim()).filter(Boolean);
  const feedbackTab = tabs.filter({ hasText: /Feedback/i }).first();
  const feedbackTabVisible = loginSucceeded && await feedbackTab.isVisible().catch(() => false);
  let ltiRootVisible = false;
  if (feedbackTabVisible) {
    await feedbackTab.click();
    await page.waitForTimeout(12000);
    const inspectedFrames = page.frames().map(frame => ({name:frame.name(), url:frame.url().split('?')[0]}));
    console.log('IFRAME_INSPECTION',JSON.stringify(inspectedFrames));
    const ltiFrame = page.frameLocator('iframe[name^="tool_content"]');
    const consent = ltiFrame.getByRole('button', { name: /Autorizar|Authorize/i });
    const hasConsent = await consent.isVisible().catch(() => false);
    if (hasConsent) {
      console.log('QA_LTI_CONSENT_PROMPT_DETECTED');
      await consent.click();
      await page.waitForTimeout(7000);
    }
    const currentFrames = page.frames().map(frame => ({name:frame.name(), url:frame.url().split('?')[0]}));
    console.log('LTI_FRAMES_AFTER_CONSENT',JSON.stringify(currentFrames));
    ltiRootVisible = await ltiFrame.locator('#root, #app').first().isVisible().catch(() => false);
  }

  const report = {
    mode: label, loginSucceeded, tabLabels, feedbackTabVisible, ltiRootVisible,
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
  if (!(report.httpPostStatus === 302 && feedbackTabVisible && ltiRootVisible)) process.exitCode = 3;
} finally {
  await browser.close();
}
