/**
 * Verifica si el servidor web de Canvas está listo para recibir peticiones.
 * Usa un endpoint público (brand_variables) que no requiere autenticación.
 * Canvas puede devolver 401 pero al menos está respondiendo.
 *
 * @returns {Promise<{ ready: boolean, error?: string }>}
 */
export async function pingCanvasAPI() {
  const baseUrl = process.env.CANVAS_BASE_URL || 'http://127.0.0.1:8080';
  try {
    const response = await fetch(`${baseUrl}/api/v1/brand_variables`, {
      signal: AbortSignal.timeout(8000),
      redirect: 'manual',
    });
    // Cualquier respuesta HTTP indica que Canvas está levantado.
    return { ready: response.status !== 0 };
  } catch (e) {
    const isNetworkError =
      e.code === 'ECONNREFUSED' ||
      e.code === 'ECONNRESET' ||
      (e.cause && (e.cause.code === 'ECONNREFUSED' || e.cause.code === 'ECONNRESET')) ||
      e.name === 'TimeoutError';
    return { ready: false, error: isNetworkError ? 'NETWORK_ERROR' : e.message };
  }
}
