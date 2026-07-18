import dotenv from 'dotenv';
import { main } from './orchestration/main.js';

dotenv.config();

import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
