import { run, requireSuccess } from '../runner.js';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
export async function prepareDocker(ctx) {
  if (!ctx.docker.available) {
    boot.warn('Docker no está disponible. No se limpiará ningún recurso; el modo 3 verificará su disponibilidad.');
    return;
  }
  for (const project of ctx.docker.projects.filter(p => p.count > 0)) {
    if (!await confirmAction({
      title: `Detener contenedores del proyecto ${project.name}`,
      detail: `Origen: ${project.dir}. Contenedores comprobados: ${project.count}. No se eliminan imágenes ni volúmenes.`
    })) throw new Error('Detención no autorizada: transición cancelada.');
    requireSuccess(await run('docker', ['compose', '-f', project.file, 'stop'], { cwd: project.dir, timeout: 120000 }), 'Detención Docker');
    boot.success(`Servicios detenidos: ${project.name}`);
  }
}
