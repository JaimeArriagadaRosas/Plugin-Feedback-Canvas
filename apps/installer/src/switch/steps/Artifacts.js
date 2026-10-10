import fs from 'node:fs/promises';
import path from 'node:path';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
export async function cleanArtifacts(ctx) {
  for (const [key, root, relative, title] of [
    ['dist', ctx.root, 'dist', 'old frontend build'],
    ['viteCache', ctx.root, 'node_modules/.vite', 'old Vite cache'],
    ['profiles', ctx.root, 'tmp/canvas_local_users.json', 'local plugin profiles'],
    ['canvasProfiles', ctx.workspace.canvas, 'tmp/perfiles_data.json', 'temporary Canvas profiles'],
    ['setupMarker', ctx.root, '.setup_complete', 'completed-installation marker'],
    ['assetsMarker', ctx.workspace.canvas, '.assets_built', 'Canvas assets marker']
  ]) {
    if (!ctx.plan.cleanup[key]) continue;
    const target = path.resolve(root, relative);
    if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('Path outside the workspace');
    let stat; try { stat = await fs.lstat(target); } catch(e) { if(e.code === 'ENOENT') continue; throw e; }
    if (stat.isSymbolicLink()) throw new Error('Symbolic link not allowed: ' + target);
    if (!await confirmAction({ title: 'Delete ' + title, detail: target })) throw new Error('Required cleanup declined: ' + title);
    await fs.rm(target, { recursive: stat.isDirectory() });
    boot.success('Removed: ' + title);
  }
}
