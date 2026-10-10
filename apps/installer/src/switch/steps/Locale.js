import fs from 'node:fs/promises';
import path from 'node:path';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
// Los overrides ignorados por Git permanecen después de cambiar de rama.
// Solo se corrige la identidad docente local; nunca se reescriben secretos.
export async function prepareLocale(ctx) {
  const envPath = path.join(ctx.root, '.env');
  let text;
  try { text = await fs.readFile(envPath, 'utf8'); }
  catch(error) { if (error.code === 'ENOENT') return; throw error; }
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex(line => /^\s*CANVAS_TEACHER_EMAIL\s*=/.test(line));
  if (index < 0) return; // el inglés utilizará su valor predeterminado
  const current = lines[index].split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  if (current === 'teacher@canvas.local') return;
  if (!await confirmAction({
    title: 'Actualizar correo docente local para la versión inglesa',
    detail: 'Se reemplazará solo CANVAS_TEACHER_EMAIL por teacher@canvas.local en .env. Valor anterior: ' + current
  })) throw new Error('El correo del docente conserva la configuración anterior; transición cancelada.');
  lines[index] = 'CANVAS_TEACHER_EMAIL=teacher@canvas.local';
  await fs.writeFile(envPath, lines.join('\n'), { mode: 0o600 });
  boot.success('Identidad docente local inglesa preparada.');
}
