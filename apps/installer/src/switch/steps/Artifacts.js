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
    if (!await confirmAction({ title: `Limpiar ${description}`, detail: `Se eliminará exclusivamente: ${path.join(ctx.root, subpath)}` })) {
      throw new Error(`El usuario no autorizó limpiar ${description}; se cancela la transición.`);
    }
    const target = path.join(ctx.root, subpath);
    const realRoot = await fs.realpath(ctx.root);
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) throw new Error(`Se rechazó el enlace simbólico ${target}`);
    const realTarget = await fs.realpath(target);
    if (!realTarget.startsWith(realRoot + path.sep)) throw new Error('Destino de limpieza fuera del repositorio');
    await fs.rm(target, { recursive: true, force: false });
    boot.success(`Limpieza completada: ${description}`);
  }
}
