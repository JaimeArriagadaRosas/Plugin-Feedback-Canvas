import { run, requireSuccess } from '../runner.js';
import { confirmAction } from '../SwitchPrompt.js';
import { boot } from '../../orchestration/boot/logger.js';

// Never reset a divergent branch, and never rewrite a branch checked out in another worktree.
// Git's 'branch -f' refuses to move a branch checked out in a linked worktree.
export async function fastForwardDestination(ctx, { execute = run, confirm = confirmAction, logger = boot } = {}) {
  const { destination, localSha, remoteSha, needsFastForward } = ctx.git;
  if (!needsFastForward) return false;

  const approved = await confirm({
    title: 'Fast-forward the local destination branch',
    detail: `Local branch ${destination} is behind: ${localSha} → ${remoteSha}. Only the local branch reference will be updated to the remote commit. No local commits or working-tree files will be overwritten.`
  });
  if (!approved) throw new Error(`Safe update of local branch ${destination} was declined; switching cancelled.`);

  const options = { cwd: ctx.root };
  const status = requireSuccess(await execute('git', ['status', '--porcelain=v1', '--untracked-files=all'], options), 'Git status').stdout;
  if (status) throw new Error('Working tree changed after inspection. No branch will be updated.');

  const nowLocal = requireSuccess(await execute('git', ['rev-parse', `refs/heads/${destination}`], options), 'Local ref').stdout;
  const nowRemote = requireSuccess(await execute('git', ['rev-parse', `refs/remotes/origin/${destination}`], options), 'Remote ref').stdout;
  if (nowLocal !== localSha || nowRemote !== remoteSha) throw new Error(`The ${destination} reference changed during inspection. No update was made.`);

  const ancestor = await execute('git', ['merge-base', '--is-ancestor', nowLocal, nowRemote], options);
  if (!ancestor.ok) throw new Error(`Branch ${destination} is no longer safe to fast-forward; no update was made.`);

  // This command refuses to force-update a branch checked out in another worktree.
  requireSuccess(await execute('git', ['branch', '-f', destination, remoteSha], options), 'Could not fast-forward the local destination branch');
  const finalSha = requireSuccess(await execute('git', ['rev-parse', `refs/heads/${destination}`], options), 'Updated ref').stdout;
  if (finalSha !== remoteSha) throw new Error('Updated branch does not match the verified remote commit.');
  logger.success(`Local branch ${destination} safely fast-forwarded.`);
  return true;
}
