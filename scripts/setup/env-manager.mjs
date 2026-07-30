import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { localEnvSchema } from './env-schema.local.mjs';
import { ListrInquirerPromptAdapter } from '@listr2/prompt-adapter-inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const ENV_PATH = path.join(ROOT_DIR, '.env');

export async function manageEnv(task) {
  let currentEnv = {};
  let envContent = '';

  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    currentEnv = dotenv.parse(envContent);
  }

  const missingKeys = Object.keys(localEnvSchema).filter(key => !currentEnv[key]);
  
  if (missingKeys.length === 0) {
    // Idempotencia absoluta: si no falta nada, retornamos inmediatamente.
    return;
  }

  const newEnvValues = {};
  for (const key of missingKeys) {
    const schema = localEnvSchema[key];
    const answer = await task.prompt(ListrInquirerPromptAdapter, {
      name: key,
      type: schema.type,
      message: schema.message,
      default: schema.initial
    });
    // Si ListrInquirerPromptAdapter retorna un objeto (ej. { PORT: '3000' }), extraer el valor.
    newEnvValues[key] = typeof answer === 'object' && answer !== null ? answer[key] || Object.values(answer)[0] : answer;
  }

  for (const key of missingKeys) {
    const value = newEnvValues[key];
    if (envContent.includes(`${key}=`)) {
      envContent = envContent.replace(new RegExp(`^${key}=.*`, 'm'), `${key}=${value}`);
    } else {
      if (envContent.length > 0 && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `${key}=${value}\n`;
    }
  }
  
  fs.writeFileSync(ENV_PATH, envContent);
}
