import { test, expect } from '@playwright/test';

test('Should mock backend response', async ({ page }) => {
  // We will simulate that the backend returns success when requesting the logged-in user
  await page.route('**/api/users/me', async (route) => {
    const json = { id: 1, email: 'test@canvas.local', rol: 'student' };
    await route.fulfill({ json });
  });

  // If there were a React dashboard screen that consumes `/api/users/me`
  // await page.goto('/dashboard');
  // await expect(page.locator('text=test@canvas.local')).toBeVisible();

  // Basic test to confirm Playwright runs
  expect(true).toBe(true);
});
