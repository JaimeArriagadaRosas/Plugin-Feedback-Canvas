import pc from 'picocolors';

/**
 * Comunicación resiliente con la API REST de Canvas.
 */
export class CanvasApi {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/json',
      ...options.headers,
    };

    if (options.body && typeof options.body !== 'string') {
      options.body = JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, { ...options, headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return await res.json();
    } catch (err) {
      throw new Error(`Error en llamada API a Canvas (${endpoint}): ${err.message}`);
    }
  }

  /** Crea una LTI 1.3 Developer Key Tool Configuration */
  async createDeveloperKey(accountId, toolConfigJson) {
    console.log(pc.gray(`➤ Creando Developer Key LTI 1.3 en la cuenta ID: ${accountId}...`));
    const endpoint = `/api/v1/accounts/${accountId}/developer_keys/tool_configuration`;
    
    // Canvas espera el body en { developer_key: { ... }, tool_configuration: { ... } }
    // Sin embargo, si mandamos directo el JSON de la tool, Canvas puede aceptarlo.
    // La documentación LTI dice que el endpoint POST espera el JSON de la herramienta directamente o envuelto.
    // Referencia Canvas API: POST /api/v1/accounts/:account_id/developer_keys/tool_configuration
    // Body: developer_key[name]=..., tool_configuration[settings]=...
    // Para simplificar, Canvas acepta un POST JSON estructurado así:
    const payload = {
      developer_key: {
        name: toolConfigJson.title || 'Unida Feedback LTI',
        email: 'admin@unab.cl', // Opcional
        notes: 'Generado automáticamente por el script de despliegue.',
        visible: true
      },
      tool_configuration: {
        settings: toolConfigJson
      }
    };

    const res = await this._request(endpoint, {
      method: 'POST',
      body: payload
    });

    console.log(pc.green(`✔ Developer Key creada. ID: ${res.developer_key.id}`));
    return res.developer_key.id;
  }

  /** Enciende la Developer Key (pasa de "off" a "on") */
  async enableDeveloperKey(keyId) {
    console.log(pc.gray(`➤ Habilitando Developer Key ${keyId}...`));
    const endpoint = `/api/v1/developer_keys/${keyId}`;
    const payload = {
      developer_key: {
        workflow_state: 'on' // El estado 'on' activa la llave.
      }
    };

    const res = await this._request(endpoint, {
      method: 'PUT',
      body: payload
    });

    if (res.workflow_state !== 'on') {
      throw new Error('La llave no se activó correctamente. Revisa los permisos.');
    }
    console.log(pc.green('✔ Developer Key habilitada y lista para uso.'));
  }

  /** Instala la External Tool (App) en la cuenta usando el Client ID */
  async installExternalTool(accountId, clientId) {
    console.log(pc.gray(`➤ Instalando herramienta en la cuenta ${accountId}...`));
    const endpoint = `/api/v1/accounts/${accountId}/external_tools`;
    const payload = {
      client_id: clientId
    };

    try {
      const res = await this._request(endpoint, {
        method: 'POST',
        body: payload
      });
      console.log(pc.green(`✔ Herramienta instalada con éxito. Tool ID: ${res.id}`));
      return res.id;
    } catch (err) {
      if (err.message.includes('400')) {
        console.warn(pc.yellow('⚠️ Canvas devolvió 400. Esto a menudo pasa si la herramienta ya está instalada o el Client ID no está activo.'));
      }
      throw err;
    }
  }
}
