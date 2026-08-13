import { test, expect } from '@playwright/test';
import { getE2ETargetConfig } from './ltiTargetConfig.mjs';

test.describe('LTI Launch Flow (E2E)', () => {
  // Ignorar errores de certificados SSL en entornos de desarrollo local
  test.use({ ignoreHTTPSErrors: true });

  test('Debería poder iniciar sesión en Canvas y acceder al LTI', async ({ page }) => {
    const { canvasUrl, canvasUser, canvasPass, courseId, isLocal } = getE2ETargetConfig();
    
    console.log(`Ejecutando E2E LTI Launch contra Canvas en: ${canvasUrl}`);

    // 1. Ir a la página de login de Canvas
    await page.goto(`${canvasUrl}/login/canvas`, { waitUntil: 'networkidle' });

    // 2. Iniciar sesión
    // Nota: El test validará si existen los elementos antes de fallar
    const emailInput = page.locator('input[name="pseudonym_session[unique_id]"]');
    const passInput = page.locator('input[name="pseudonym_session[password]"]');
    const loginBtn = page.locator('button[type="submit"], input[type="submit"]');

    if (await emailInput.isVisible()) {
      await emailInput.fill(canvasUser);
      await passInput.fill(canvasPass);
      await loginBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // 3. Abrir el curso de prueba
    await page.goto(`${canvasUrl}/courses/${courseId}`, { waitUntil: 'networkidle' });
    
    // Validar que se ha cargado el curso
    await expect(page.locator('body')).toContainText(/Home|Inicio/i);

    // 4. Hacer clic en la herramienta LTI (Buscamos un enlace en la barra de navegación)
    // Asumiremos que el nombre es "Feedback" (o el nombre que configuraste en tu XML LTI)
    const ltiLink = page.locator('#section-tabs a', { hasText: /Feedback/i }).first();
    
    if (await ltiLink.isVisible()) {
      await ltiLink.click();
      await page.waitForLoadState('networkidle');
      
      // 5. Verificar que el componente React carga sin errores dentro del iframe
      const ltiIframe = page.frameLocator('iframe#tool_content');
      
      // Asegurarse de que el iframe del LTI cargó y la aplicación React renderizó
      await expect(ltiIframe.locator('#root, #app')).toBeVisible({ timeout: 15000 });
      
      // Podrías agregar asserts específicos aquí dependiendo del UI de React, ej:
      // await expect(ltiIframe.locator('h1')).toContainText('Bienvenido al Feedback');
    } else {
      if (isLocal) {
        console.log('El enlace LTI "Feedback" no es visible en el menu local. Omitiendo validacion del iframe.');
      } else {
        throw new Error('La herramienta LTI Feedback no aparece en el curso de Canvas real.');
      }
    }
  });
});
