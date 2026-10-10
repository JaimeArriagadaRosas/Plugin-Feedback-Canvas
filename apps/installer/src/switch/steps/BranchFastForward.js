import { run, requireSuccess } from '../runner.js';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';

// Never reset a divergent branch, and never rewrite a branch checked out in another worktree.
// Git's 'branch -f' refuses to move a branch checked out in a linked worktree.
export async function fastForwardDestination(ctx, { execute = run, confirm = confirmAction, logger = boot } = {}) {
  const { destination, localSha, remoteSha, needsFastForward } = ctx.git;
  if (!needsFastForward) return false;

  const approved = await confirm({
    title: 'Actualizar rama local de destino mediante fast-forward',
    detail: `La rama local ${destination} está atrasada: ${localSha} → ${remoteSha}. Se actualizará únicamente esta referencia al commit remoto, sin descartar commits propios ni modificar los archivos de la rama activa.`
  });
  if (!approved) throw new Error(`Se rechazó la actualización segura de la rama local ${destination}; transición cancelada.`);

  const options = { cwd: ctx.root };
  const status = requireSuccess(await execute('git', ['status', '--porcelain=v1', '--untracked-files=all'], options), 'Git status').stdout;
  if (status) throw new Error('El árbol de trabajo cambió desde el diagnóstico. No se actualizará ninguna rama.');

  const nowLocal = requireSuccess(await execute('git', ['rev-parse', `refs/heads/${destination}`], options), 'Local ref').stdout;
  const nowRemote = requireSuccess(await execute('git', ['rev-parse', `refs/remotes/origin/${destination}`], options), 'Remote ref').stdout;
  if (nowLocal !== localSha || nowRemote !== remoteSha) throw new Error(`La referencia de ${destination} cambió durante la inspección. No se actualizará.`);

  const ancestor = await execute('git', ['merge-base', '--is-ancestor', nowLocal, nowRemote], options);
  if (!ancestor.ok) throw new Error(`La rama ${destination} ya no admite un avance directo seguro. No se actualizará.`);

  // This command refuses to force-update a branch checked out in another worktree.
  requireSuccess(await execute('git', ['branch', '-f', destination, remoteSha], options), 'No se pudo actualizar la rama local de destino');
  const finalSha = requireSuccess(await execute('git', ['rev-parse', `refs/heads/${destination}`], options), 'Updated ref').stdout;
  if (finalSha !== remoteSha) throw new Error('Updated branch does not match the verified remote commit.');
  logger.success(`Rama local ${destination} actualizada mediante avance directo.`);
  return true;
}
