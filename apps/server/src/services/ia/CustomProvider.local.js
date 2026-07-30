/**
 * Módulo .local.js para inyectar configuraciones exclusivas del entorno
 * de desarrollo local al CustomProvider, sin filtrarse a producción.
 */

export function getCustomFetchConfig() {
  const config = {};
  
  // Ejemplo: si el entorno es 'development', y se está conectando a un Ollama local
  // con HTTPS autofirmado, podemos desactivar la verificación estricta TLS.
  // Nota: En Node.js puro sin 'https' agent, fetch nativo obedece a NODE_TLS_REJECT_UNAUTHORIZED.
  
  if (process.env.NODE_ENV === 'development') {
    // Aquí se podrían agregar agentes de proxy, agentes Https con rejectUnauthorized: false, etc.
    // Ej: config.agent = new https.Agent({ rejectUnauthorized: false });
  }

  return config;
}
