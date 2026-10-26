import {describe,it,expect,vi,afterEach} from 'vitest';
import TokenRotationJob from '../../src/services/auth/TokenRotationJob.js';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
describe('rotation lifecycle regression',()=>{
 it('start is idempotent and stop cancels interval and initial callback',async()=>{
  vi.useFakeTimers();
  const repo={getExpiringTokens:vi.fn().mockResolvedValue([])};
  const job=new TokenRotationJob({tokenRepo:repo},10000);
  job.start();job.start();
  await vi.advanceTimersByTimeAsync(5000);
  expect(repo.getExpiringTokens).toHaveBeenCalledTimes(1);
  job.stop();
  await vi.advanceTimersByTimeAsync(50000);
  expect(repo.getExpiringTokens).toHaveBeenCalledTimes(1);
 });
 it('never overlaps scans if prior rotation is unfinished',async()=>{
  let done;
  const blocker=new Promise(r=>{done=r});
  const repo={getExpiringTokens:vi.fn().mockReturnValue(blocker)};
  const job=new TokenRotationJob({tokenRepo:repo});
  const first=job.run(),second=job.run();
  expect(repo.getExpiringTokens).toHaveBeenCalledTimes(1);
  done([]);
  await Promise.all([first,second]);
 });
 it('shutdown stops starting the next queued refresh',async()=>{
  let release;
  const held=new Promise(r=>{release=r});
  const refreshToken=vi.fn().mockReturnValueOnce(held).mockResolvedValue('ok');
  const repo={getExpiringTokens:vi.fn().mockResolvedValue([{canvas_sub:'one',refresh_token:'r1'},{canvas_sub:'two',refresh_token:'r2'}])};
  const job=new TokenRotationJob({tokenRepo:repo,refreshToken});
  job.start();
  const pending=job.run();
  await vi.waitFor(()=>expect(refreshToken).toHaveBeenCalledTimes(1));
  const stopping=job.stop();
  release('ok');
  await Promise.all([pending,stopping]);
  expect(refreshToken).toHaveBeenCalledTimes(1);
 });
});
