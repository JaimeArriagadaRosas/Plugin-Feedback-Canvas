import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isLocal = process.env.E2E_TARGET !== 'real';

const CANVAS_URL = isLocal 
  ? 'https://localhost:8443' 
  : (process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com');

// Estas son credenciales de prueba; en Canvas local están seteadas por los scripts de Python.
// Si es 'real' (UNAB), el usuario deberá inyectarlas en el .env
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'profesor@canvas.local';
const TEST_PASS = process.env.TEST_USER_PASS || 'password123';

test.describe('LTI 1.3 End-to-End Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Para probar local (Docker) o servidores LTI sin cert válido aún.
    await page.context().route('**/*', (route) => {
      route.continue();
    });
  });

  test('Debería loguearse en Canvas, lanzar la herramienta y completar el handshake LTI', async ({ page }) => {
    console.log(`[E2E] Navegando al Canvas destino: ${CANVAS_URL}`);

    // 1. Ir a la pantalla de login de Canvas
    await page.goto(`${CANVAS_URL}/login/canvas`, { waitUntil: 'networkidle' });

    // 2. Llenar credenciales de profesor/admin
    // (Asumimos el DOM estándar de Canvas LMS)
    const emailField = page.locator('input[name="pseudonym_session[unique_id]"]');
    const passField = page.locator('input[name="pseudonym_session[password]"]');
    const loginBtn = page.locator('button[type="submit"]');

    if (await emailField.isVisible()) {
      console.log(`[E2E] Iniciando sesión con: ${TEST_EMAIL}`);
      await emailField.fill(TEST_EMAIL);
      await passField.fill(TEST_PASS);
      await loginBtn.click();
    } else {
      console.log('[E2E] Ya autenticado o el DOM es distinto.');
    }

    // Esperar a que el dashboard cargue
    await page.waitForURL(/.*\/(\?.*)?/, { timeout: 15000 });
    
    // 3. Entrar a un curso de prueba (asumimos Course ID 1, común en pruebas E2E)
    const courseUrl = `${CANVAS_URL}/courses/1`;
    console.log(`[E2E] Ingresando al curso: ${courseUrl}`);
    const response = await page.goto(courseUrl);
    
    if (response && response.status() === 404) {
       console.log('[E2E] Advertencia: El Curso ID 1 no existe en este entorno. El test puede fallar al buscar el botón.');
    }

    // 4. Buscar el enlace de la herramienta externa en el menú izquierdo de Canvas
    // Canvas suele usar una clase 'context_external_tool_XXX' o el texto.
    console.log('[E2E] Buscando la pestaña de la herramienta LTI...');
    const ltiTab = page.locator('a.context_external_tool').first(); 
    
    // Si no está visible en el menú lateral normal de canvas, se intentará usar un texto genérico o fallará, 
    // pero eso prueba que la developer key NO está bien enlazada.
    if (await ltiTab.isVisible()) {
      await ltiTab.click();
    } else {
      // Intento 2: Buscar un enlace con "Feedback"
      const feedbackLink = page.getByRole('link', { name: /Feedback|LTI/i });
      await expect(feedbackLink).toBeVisible({ timeout: 10000 });
      await feedbackLink.first().click();
    }

    // 5. Interactuar con el iframe del Plugin
    // Canvas LMS inyecta la herramienta LTI dentro de un iframe con id 'tool_content'
    console.log('[E2E] Esperando la inyección del Iframe (Handshake OIDC)...');
    const toolIframe = page.frameLocator('#tool_content');
    
    // Verificamos si el plugin logra renderizar algo sin arrojar pantalla en blanco / estado 500
    // Asumimos que la app renderiza un div con id "root" o una clase específica
    console.log('[E2E] Verificando renderizado del Plugin...');
    const appRoot = toolIframe.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: 15000 });

    console.log('[E2E] ✔ Handshake OIDC LTI 1.3 Exitoso. La aplicación cargó en el Iframe.');
  });
});
