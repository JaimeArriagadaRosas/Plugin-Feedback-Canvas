import fs from 'node:fs/promises';
import path from 'node:path';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
export async function cleanArtifacts(ctx) {
  for (const [key, subpath, description] of [
    ['dist', 'dist', 'compilación anterior del frontend'],
    ['viteCache', 'node_modules/.vite', 'caché de Vite']
  ]) {
    if (!ctx.plan.cleanup[key]) continue;
    const target = path.join(ctx.root, subpath);
    let stat;
    try { stat = await fs.lstat(target); }
    catch (error) {
      if (error.code === 'ENOENT') { boot.info(`Ya no existe ${description}; omitiendo.`); continue; }
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Se rechazó el enlace simbólico ${target}`);
    const realRoot = await fs.realpath(ctx.root);
    const realTarget = await fs.realpath(target);
    if (!realTarget.startsWith(realRoot + path.sep)) throw new Error('Destino de limpieza fuera del repositorio');
    if (!await confirmAction({ title: `Limpiar ${description}`, detail: `Se eliminará exclusivamente: ${target}` })) {
      throw new Error(`No se autorizó la limpieza de ${description}; transición cancelada.`);
    }
    await fs.rm(target, { recursive: true, force: false });
    boot.success(`Limpieza completada: ${description}`);
  }
}
