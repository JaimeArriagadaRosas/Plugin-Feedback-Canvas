import { test, expect } from 'vitest';
import { fastForwardDestination } from '../steps/BranchFastForward.js';

const success = (stdout = '') => ({ ok: true, stdout, stderr: '', code: 0 });
const fail = (stderr = 'failure') => ({ ok: false, stdout: '', stderr, code: 1 });

const ctx = {
  root: '/repo',
  git: {
    destination: 'main',
    localSha: 'a'.repeat(40),
    remoteSha: 'b'.repeat(40),
    needsFastForward: true
  }
};

function simulate(responses) {
  const calls = [];
  return {
    calls,
    execute: async (command, args) => {
      calls.push([command, ...args]);
      if (!responses.length) throw new Error('Unexpected command');
      return responses.shift();
    }
  };
}
const logger = { success: () => {} };

test('a destination already current requires no command or confirmation', async () => {
  let called = false;
  const result = await fastForwardDestination({ ...ctx, git: { ...ctx.git, needsFastForward: false } }, {
    execute: async () => { called = true; },
    confirm: async () => { called = true; },
    logger
  });
  expect(result).toBe(false);
  expect(called).toBe(false);
});

test('a declined update never modifies the branch', async () => {
  const s = simulate([]);
  await expect(fastForwardDestination(ctx, { execute: s.execute, confirm: async () => false, logger })).rejects.toThrow();
  expect(s.calls).toHaveLength(0);
});

test('approved fast-forward checks original refs and ancestry before updating once', async () => {
  const s = simulate([
    success(''), success(ctx.git.localSha), success(ctx.git.remoteSha),
    success(), success(), success(ctx.git.remoteSha)
  ]);
  const result = await fastForwardDestination(ctx, { execute: s.execute, confirm: async () => true, logger });
  expect(result).toBe(true);
  expect(s.calls.filter(c => c[1] === 'branch')).toEqual([['git', 'branch', '-f', 'main', ctx.git.remoteSha]]);
  expect(s.calls.some(c => c[1] === 'merge-base')).toBe(true);
});

test('local ref changing after inspection prevents updating it', async () => {
  const s = simulate([success(''), success('c'.repeat(40)), success(ctx.git.remoteSha)]);
  await expect(fastForwardDestination(ctx, { execute: s.execute, confirm: async () => true, logger })).rejects.toThrow();
  expect(s.calls.some(c => c[1] === 'branch')).toBe(false);
});

test('non-fast-forward history is rejected without modifying refs', async () => {
  const s = simulate([
    success(''), success(ctx.git.localSha), success(ctx.git.remoteSha), fail('not ancestor')
  ]);
  await expect(fastForwardDestination(ctx, { execute: s.execute, confirm: async () => true, logger })).rejects.toThrow();
  expect(s.calls.some(c => c[1] === 'branch')).toBe(false);
});

test('Git refuses updating a branch checked out in another worktree; error is preserved', async () => {
  const s = simulate([
    success(''), success(ctx.git.localSha), success(ctx.git.remoteSha),
    success(), fail('branch is checked out in another worktree')
  ]);
  await expect(fastForwardDestination(ctx, { execute: s.execute, confirm: async () => true, logger })).rejects.toThrow(/checked out/);
  expect(s.calls.filter(c => c[1] === 'branch')).toHaveLength(1);
});
