import fs from 'node:fs/promises';
import path from 'node:path';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
export async function cleanArtifacts(ctx) {
  for (const [key, root, relative, title] of [
    ['dist', ctx.root, 'dist', 'compilación frontend anterior'],
    ['viteCache', ctx.root, 'node_modules/.vite', 'caché Vite anterior'],
    ['profiles', ctx.root, 'tmp/canvas_local_users.json', 'perfiles locales del plugin'],
    ['canvasProfiles', ctx.workspace.canvas, 'tmp/perfiles_data.json', 'perfiles temporales Canvas'],
    ['setupMarker', ctx.root, '.setup_complete', 'marcador de instalación completa'],
    ['assetsMarker', ctx.workspace.canvas, '.assets_built', 'marcador de assets Canvas']
  ]) {
    if (!ctx.plan.cleanup[key]) continue;
    const target = path.resolve(root, relative);
    if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('Ruta externa al workspace');
    let stat; try { stat = await fs.lstat(target); } catch(e) { if(e.code === 'ENOENT') continue; throw e; }
    if (stat.isSymbolicLink()) throw new Error('Enlace simbólico no permitido: ' + target);
    if (!await confirmAction({ title: 'Eliminar ' + title, detail: target })) throw new Error('Limpieza necesaria rechazada: ' + title);
    await fs.rm(target, { recursive: stat.isDirectory() });
    boot.success('Eliminado: ' + title);
  }
}
