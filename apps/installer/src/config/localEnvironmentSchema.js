// Local environment schema for configuration validation
// Local schema of default variables for idempotency.
// If .env does not have them, they will be completed using these values or asking via listr2 prompt.

export const localEnvSchema = {
  PORT: {
    type: 'input',
    message: 'Port for the Node.js server:',
    initial: '3000'
  },
  AUTO_MIGRATE: {
    type: 'input',
    message: 'Run database migrations when starting the server (true/false):',
    initial: 'true'
  },
  DATABASE_URL: {
    type: 'input',
    message: 'PostgreSQL connection URL:',
    initial: 'postgres://postgres:CHANGE_ME_db_password_strong@127.0.0.1:5432/feedback_plugin_db'
  },
  ENCRYPTION_KEY: {
    type: 'input',
    message: 'Encryption key for Canvas (minimum 32 characters):',
    initial: 'default_development_encryption_key_32_chars'
  },
  WEBHOOK_SECRET: {
    type: 'input',
    message: 'Secret for webhooks:',
    initial: 'default_webhook_secret'
  },
  CANVAS_CLIENT_ID: {
    type: 'input',
    message: 'Canvas LTI Client ID (you can leave the default if you don\'t have it yet):',
    initial: '10000000000001'
  }
};
