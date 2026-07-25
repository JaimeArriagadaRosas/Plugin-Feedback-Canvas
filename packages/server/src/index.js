// Configurar variables para silenciar logs de dotenv/dotenvx ANTES de importarlo
process.env.DOTENV_QUIET = 'true';
process.env.DOTENVX_QUIET = 'true';

process.setMaxListeners(20);
import dotenv from 'dotenv';
const dotenvRes = dotenv.config({ quiet: true });
const count = dotenvRes.parsed ? Object.keys(dotenvRes.parsed).length : 0;
console.log(`  · injected env (${count}) from .env // tip: encrypted .env [www.dotenvx.com]`);

import { main } from './orchestration/main.js';

main();
