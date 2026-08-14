import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';

/**
 * Dynamically modifies the lti_placement.json file to adapt it to the production domain.
 */
export async function buildDynamicLtiConfig(pluginDir, domain) {
  const configPath = path.join(pluginDir, 'config', 'lti_placement.json');
  
  let rawJson = '';
  try {
    rawJson = await fs.readFile(configPath, 'utf8');
  } catch (err) {
    throw new Error(`config/lti_placement.json not found: ${err.message}`);
  }

  // In the current template, we have "localhost", "localhost:8443", and "https://localhost:3000".
  // We will parse it and replace the values in the structure to be precise.
  const config = JSON.parse(rawJson);

  // Extract host without protocol for the domain field
  const hostMatch = domain.replace(/^https?:\/\//, '').split('/')[0];

  // Modify extensions
  if (config.extensions && config.extensions.length > 0) {
    config.extensions[0].domain = hostMatch;
    // main target_link_uri (usually login or callback depending on canvas, we will assimilate callback for the button)
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

  // Global URI replacements
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
