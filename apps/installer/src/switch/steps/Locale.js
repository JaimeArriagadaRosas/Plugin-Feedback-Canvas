import fs from 'node:fs/promises';
import path from 'node:path';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
// Git-ignored overrides remain in place after switching branches.
// Adjust only the local teacher identity; never rewrite secrets.
export async function prepareLocale(ctx) {
  const envPath = path.join(ctx.root, '.env');
  let text;
  try { text = await fs.readFile(envPath, 'utf8'); }
  catch(error) { if (error.code === 'ENOENT') return; throw error; }
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex(line => /^\s*CANVAS_TEACHER_EMAIL\s*=/.test(line));
  if (index < 0) return; // Spanish will use its default
  const current = lines[index].split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  if (current === 'profesor@canvas.local') return;
  if (!await confirmAction({
    title: 'Update local teacher email for the Spanish version',
    detail: 'Only CANVAS_TEACHER_EMAIL will be changed to profesor@canvas.local in .env. Previous value: ' + current
  })) throw new Error('Teacher email still has the previous configuration; switching cancelled.');
  lines[index] = 'CANVAS_TEACHER_EMAIL=profesor@canvas.local';
  await fs.writeFile(envPath, lines.join('\n'), { mode: 0o600 });
  boot.success('Spanish local teacher identity prepared.');
}
