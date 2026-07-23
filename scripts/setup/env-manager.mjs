import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, '.env.example');

export async function manageEnv() {
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    throw new Error('.env.example file is missing from the root directory.');
  }

  const exampleEnv = dotenv.parse(fs.readFileSync(ENV_EXAMPLE_PATH));
  let currentEnv = {};

  if (fs.existsSync(ENV_PATH)) {
    currentEnv = dotenv.parse(fs.readFileSync(ENV_PATH));
  } else {
    fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
  }

  const missingKeys = Object.keys(exampleEnv).filter(key => !currentEnv[key]);
  
  if (missingKeys.length > 0) {
    let envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    for (const key of missingKeys) {
      const value = exampleEnv[key];
      if (envContent.includes(`${key}=`)) {
        envContent = envContent.replace(new RegExp(`^${key}=.*`, 'm'), `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }
    fs.writeFileSync(ENV_PATH, envContent);
  }
}
