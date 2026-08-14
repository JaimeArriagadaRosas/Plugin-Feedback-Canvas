// Suppress dotenv/dotenvx logs BEFORE importing it
process.env.DOTENV_QUIET = 'true';
process.env.DOTENVX_QUIET = 'true';

process.setMaxListeners(20);
import dotenv from 'dotenv';
const dotenvRes = dotenv.config({ quiet: true });
const count = dotenvRes.parsed ? Object.keys(dotenvRes.parsed).length : 0;
import { boot as logger } from './orchestration/boot/logger.js';
logger.info(`Environment loaded from .env (${count} variables).`);

import { main } from './orchestration/main.js';

const modeArgument = process.argv.find((argument) => argument.startsWith('--mode='));
const mode = modeArgument?.split('=')[1];
main({ mode });
