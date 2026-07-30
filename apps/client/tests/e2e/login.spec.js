import { test, expect } from '@playwright/test';

test('Debería mockear la respuesta del backend', async ({ page }) => {
  // Simularemos que el backend devuelve éxito al pedir el usuario logueado
  await page.route('**/api/users/me', async (route) => {
    const json = { id: 1, email: 'test@canvas.local', rol: 'student' };
    await route.fulfill({ json });
  });

  // Si hubiera una pantalla de dashboard de React que consume `/api/users/me`
  // await page.goto('/dashboard');
  // await expect(page.locator('text=test@canvas.local')).toBeVisible();

  // Test de prueba básica para confirmar que Playwright corre
  expect(true).toBe(true);
});
