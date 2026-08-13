import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';

/**
 * Modifica dinámicamente el archivo lti_placement.json para adaptarlo al dominio de producción.
 */
export async function buildDynamicLtiConfig(pluginDir, domain) {
  const configPath = path.join(pluginDir, 'config', 'lti_placement.json');
  
  let rawJson = '';
  try {
    rawJson = await fs.readFile(configPath, 'utf8');
  } catch (err) {
    throw new Error(`No se encontró config/lti_placement.json: ${err.message}`);
  }

  // En la plantilla actual, tenemos "localhost", "localhost:8443", y "https://localhost:3000".
  // Vamos a parsearlo y reemplazar los valores en la estructura para ser precisos.
  const config = JSON.parse(rawJson);

  // Extraer host sin protocolo para el domain field
  const hostMatch = domain.replace(/^https?:\/\//, '').split('/')[0];

  // Modificar extensiones
  if (config.extensions && config.extensions.length > 0) {
    config.extensions[0].domain = hostMatch;
    // target_link_uri principal (generalmente el login o el callback dependendiendo de canvas, asimilaremos callback para el boton)
    if (config.extensions[0].settings) {
      config.extensions[0].settings.icon_url = `${domain}/icon.png`;
      if (config.extensions[0].settings.placements) {
        config.extensions[0].settings.placements.forEach(p => {
          if (p.target_link_uri) {
            p.target_link_uri = p.target_link_uri.replace(/https?:\/\/localhost:\d+/, domain);
          }
        });
      }
    }
  }

  // Reemplazos de URIs globales
  if (config.public_jwk_url) {
    config.public_jwk_url = config.public_jwk_url.replace(/https?:\/\/localhost:\d+/, domain);
  }
  if (config.target_link_uri) {
    config.target_link_uri = config.target_link_uri.replace(/https?:\/\/localhost:\d+/, domain);
  }
  if (config.oidc_initiation_url) {
    config.oidc_initiation_url = config.oidc_initiation_url.replace(/https?:\/\/localhost:\d+/, domain);
  }

  return config;
}
