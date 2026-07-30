// scripts/setup/env-schema.local.mjs
// Esquema local de variables por defecto para la idempotencia.
// Si el .env no las tiene, se completarán usando estos valores o preguntando mediante listr2 prompt.

export const localEnvSchema = {
  PORT: {
    type: 'input',
    message: 'Puerto para el servidor de Node.js:',
    initial: '3000'
  },
  DATABASE_URL: {
    type: 'input',
    message: 'URL de conexión a PostgreSQL:',
    initial: 'postgres://postgres:CHANGE_ME_db_password_strong@127.0.0.1:5432/feedback_plugin_db'
  },
  ENCRYPTION_KEY: {
    type: 'input',
    message: 'Clave de encriptación para Canvas (mínimo 32 caracteres):',
    initial: 'default_development_encryption_key_32_chars'
  },
  WEBHOOK_SECRET: {
    type: 'input',
    message: 'Secreto para webhooks:',
    initial: 'default_webhook_secret'
  },
  CANVAS_CLIENT_ID: {
    type: 'input',
    message: 'Canvas LTI Client ID (puedes dejar el por defecto si aún no lo tienes):',
    initial: '10000000000001'
  }
};
