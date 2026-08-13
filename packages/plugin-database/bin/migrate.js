#!/usr/bin/env node

import { runMigrations } from '../src/index.js';

runMigrations().catch((error) => {
  console.error(`[MIGRATION] Error general: ${error.message}`);
  process.exitCode = 1;
});
