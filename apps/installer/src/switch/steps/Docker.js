import { run, requireSuccess } from '../runner.js';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';
export async function prepareDocker(ctx) {
  if (!ctx.docker.available) {
    if (ctx.workspace.canvasExists) throw new Error('Docker no disponible: imposible certificar una limpieza profunda.');
    return;
  }
  for (const project of ctx.plan.projects) {
    for (const container of project.containers) {
      if (!await confirmAction({ title: 'Eliminar contenedor antiguo: ' + container.name,
        detail: 'Proyecto: ' + project.projectName + '. Se detendrá primero si está activo; no se eliminará ningún volumen.' })) throw new Error('Contenedor conservado por decisión del usuario: cambio cancelado.');
      requireSuccess(await run('docker', ['rm', '-f', container.id], { timeout: 90000 }), 'Eliminar contenedor propio');
      boot.success('Contenedor eliminado: ' + container.name);
    }
    for (const volume of project.volumes) {
      if (!volume.exclusive) throw new Error('Volumen usado por otro proyecto: ' + volume.name + '. No se eliminará.');
      if (!await confirmAction({ title: 'ELIMINAR DATOS PERSISTENTES: ' + volume.name,
        detail: 'Se perderán permanentemente cuentas y datos de esta base de datos/servicio. Proyecto ' + project.projectName + '.', risk: 'high' }))
        throw new Error('El usuario decidió conservar los datos de ' + volume.name + '; cambio limpio cancelado.');
      requireSuccess(await run('docker', ['volume', 'rm', volume.name]), 'Eliminar volumen autorizado');
      boot.success('Volumen eliminado: ' + volume.name);
    }
  }
}
