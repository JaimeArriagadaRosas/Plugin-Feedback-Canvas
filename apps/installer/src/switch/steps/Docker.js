import { run, requireSuccess } from '../runner.js';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
export async function prepareDocker(ctx) {
  if (!ctx.docker.available) {
    boot.warn('Docker no está disponible; el modo 3 verificará su estado.');
    return;
  }
  for (const project of ctx.docker.projects) {
    if (project.name === 'canvas') {
      boot.info('Canvas LMS es un recurso compartido; no se detendrán sus contenedores.');
      continue;
    }
    if (project.error) throw new Error(`No se pudo verificar propiedad Docker de ${project.name}: ${project.error}`);
    for (const id of project.ids || []) {
      const label = requireSuccess(await run('docker', [
        'inspect', '--format', '{{index .Config.Labels "com.docker.compose.project.working_dir"}}', id
      ]), 'Identidad del contenedor').stdout;
      if (label !== project.dir) throw new Error('La identidad del contenedor cambió; no se detendrá.');
      if (!await confirmAction({
        title: `Detener contenedor del proyecto ${project.name}`,
        detail: `Contenedor: ${id.slice(0, 12)}. Workspace: ${project.dir}. No se eliminan imágenes, datos ni volúmenes.`
      })) throw new Error('Detención no autorizada; transición cancelada.');
      requireSuccess(await run('docker', ['stop', id], { timeout: 90000 }), 'Detención de contenedor propio');
      boot.success(`Contenedor detenido: ${id.slice(0, 12)}`);
    }
  }
}
