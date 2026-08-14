import { test, expect } from '@playwright/test';
import { getE2ETargetConfig } from './ltiTargetConfig.mjs';

test.describe('LTI Launch Flow (E2E)', () => {
  // Ignore SSL certificate errors in local development environments
  test.use({ ignoreHTTPSErrors: true });

  test('Should be able to log into Canvas and access the LTI', async ({ page }) => {
    const { canvasUrl, canvasUser, canvasPass, courseId, isLocal } = getE2ETargetConfig();
    
    console.log(`Running E2E LTI Launch against Canvas at: ${canvasUrl}`);

    // 1. Go to Canvas login page
    await page.goto(`${canvasUrl}/login/canvas`, { waitUntil: 'networkidle' });

    // 2. Log in
    // Note: The test will validate if the elements exist before failing
    const emailInput = page.locator('input[name="pseudonym_session[unique_id]"]');
    const passInput = page.locator('input[name="pseudonym_session[password]"]');
    const loginBtn = page.locator('button[type="submit"], input[type="submit"]');

    if (await emailInput.isVisible()) {
      await emailInput.fill(canvasUser);
      await passInput.fill(canvasPass);
      await loginBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // 3. Open the test course
    await page.goto(`${canvasUrl}/courses/${courseId}`, { waitUntil: 'networkidle' });
    
    // Validate that the course has loaded
    await expect(page.locator('body')).toContainText(/Home|Inicio/i);

    // 4. Click on the LTI tool (We look for a link in the navigation bar)
    // We will assume the name is "Feedback" (or the name you configured in your LTI XML)
    const ltiLink = page.locator('#section-tabs a', { hasText: /Feedback/i }).first();
    
    if (await ltiLink.isVisible()) {
      await ltiLink.click();
      await page.waitForLoadState('networkidle');
      
      // 5. Verify that the React component loads without errors inside the iframe
      const ltiIframe = page.frameLocator('iframe#tool_content');
      
      // Ensure the LTI iframe loaded and the React app rendered
      await expect(ltiIframe.locator('#root, #app')).toBeVisible({ timeout: 15000 });
      
      // You could add specific asserts here depending on the React UI, e.g.:
      // await expect(ltiIframe.locator('h1')).toContainText('Welcome to Feedback');
    } else {
      if (isLocal) {
        console.log('The LTI "Feedback" link is not visible in the local menu. Skipping iframe validation.');
      } else {
        throw new Error('The LTI Feedback tool does not appear in the real Canvas course.');
      }
    }
  });
});
