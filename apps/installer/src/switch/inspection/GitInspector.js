import path from 'node:path';
import { run, requireSuccess } from '../runner.js';
export async function inspectGit(root) {
  const top = requireSuccess(await run('git', ['rev-parse', '--show-toplevel'], { cwd: root }), 'Git root').stdout;
  if (path.resolve(top) !== path.resolve(root)) throw new Error('The selected directory is not the repository root.');
  const current = requireSuccess(await run('git', ['branch', '--show-current'], { cwd: root }), 'Rama').stdout;
  const status = requireSuccess(await run('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root }), 'Cambios locales').stdout;
  const remote = requireSuccess(await run('git', ['remote', 'get-url', 'origin'], { cwd: root }), 'Origen').stdout;
  if (!/^https:\/\/github\.com\/JaimeArriagadaRosas\/Plugin-Feedback-Canvas(?:\.git)?\/?$|^git@github\.com:JaimeArriagadaRosas\/Plugin-Feedback-Canvas(?:\.git)?$/.test(remote)) {
    throw new Error('The origin remote does not match the authorized repository.');
  }
  const allowed = new Set(['main', 'english-version']);
  if (!allowed.has(current)) throw new Error(`Branch not supported for switching: ${current}`);
  if (status) throw new Error('Uncommitted local changes detected. No files will be modified:\n' + status.slice(0, 1200));
  const destination = current === 'english-version' ? 'main' : 'english-version';
  const fetched = await run('git', ['fetch', '--no-tags', 'origin', `+refs/heads/${destination}:refs/remotes/origin/${destination}`], { cwd: root, timeout: 120000 });
  if (!fetched.ok) throw new Error(`Could not refresh origin/${destination}; a stale reference will not be used: ${fetched.stderr}`);
  const local = await run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${destination}`], { cwd: root });
  const sourceLock = requireSuccess(await run('git', ['rev-parse', 'HEAD:package-lock.json'], { cwd: root }), 'Lockfile origen').stdout;
  const destinationLock = requireSuccess(await run('git', ['rev-parse', `origin/${destination}:package-lock.json`], { cwd: root }), 'Lockfile destino').stdout;
  let localSha = null;
  let remoteSha = null;
  let needsFastForward = false;
  if (local.ok) {
    localSha = requireSuccess(await run('git', ['rev-parse', destination], { cwd: root }), 'Local revision').stdout;
    remoteSha = requireSuccess(await run('git', ['rev-parse', `origin/${destination}`], { cwd: root }), 'Remote revision').stdout;
    if (localSha !== remoteSha) {
      const ancestor = await run('git', ['merge-base', '--is-ancestor', localSha, remoteSha], { cwd: root });
      if (!ancestor.ok) throw new Error(`Local branch ${destination} has its own commits or diverges from origin/${destination}; manual review is required; history will not be overwritten.`);
      needsFastForward = true;
    }
  }
  return { current, destination, localBranch: local.ok, lockfileChanged: sourceLock !== destinationLock, root, localSha, remoteSha, needsFastForward };
}
