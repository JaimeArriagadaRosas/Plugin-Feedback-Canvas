import { describe,it,expect,vi,afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
const mocks=vi.hoisted(()=>({stopBackend:vi.fn(),stopVite:vi.fn(),boot:{stage:vi.fn(),info:vi.fn(),warn:vi.fn(),success:vi.fn(),endStage:vi.fn()}}));
vi.mock('../../src/orchestration/process.js',()=>({stopBackend:mocks.stopBackend,stopVite:mocks.stopVite}));
vi.mock('../../src/orchestration/boot/logger.js',()=>({boot:mocks.boot}));
import {setupGracefulShutdown} from '../../src/orchestration/shutdown_utils.js';
const {stopBackend:stopChild}=await vi.importActual('../../src/orchestration/process.js');
afterEach(()=>{process.removeAllListeners('SIGINT');process.removeAllListeners('SIGTERM');vi.restoreAllMocks();mocks.stopBackend.mockReset();mocks.stopVite.mockReset();});
describe('graceful shutdown acceptance',()=>{
 it('closes owned services once in order and exits zero',async()=>{
  const order=[];
  mocks.stopBackend.mockImplementation(async()=>{order.push('backend')});
  mocks.stopVite.mockImplementation(async()=>{order.push('vite')});
  const tls={stopTlsProxy:vi.fn(async()=>{order.push('tls')})};
  const exit=vi.spyOn(process,'exit').mockImplementation(code=>{throw Error('EXIT_'+code)});
  const shutdown=setupGracefulShutdown({pid:123},tls);
  await expect(shutdown()).rejects.toThrow('EXIT_0');
  expect(order).toEqual(['tls','backend','vite']);
  expect(exit).toHaveBeenCalledWith(0);
 });
 it('repeated shutdown requests share a single cleanup',async()=>{
  let done;
  const wait=new Promise(r=>{done=r});
  mocks.stopBackend.mockReturnValue(wait);
  mocks.stopVite.mockResolvedValue();
  const exit=vi.spyOn(process,'exit').mockImplementation(code=>{throw Error('EXIT_'+code)});
  const shutdown=setupGracefulShutdown({pid:123},null);
  const a=shutdown();
  const b=shutdown();
  expect(a).toBe(b);
  done();
  await expect(a).rejects.toThrow('EXIT_0');
  expect(exit).toHaveBeenCalledTimes(1);
 });
 it('child waiting for SIGINT completes when exit fires',async()=>{
  const child=new EventEmitter();child.killed=false;child.kill=vi.fn().mockReturnValue(true);
  const wait=stopChild(child);
  expect(child.kill).toHaveBeenCalledWith('SIGINT');
  child.emit('exit',0);
  await expect(wait).resolves.toBeUndefined();
 });
});
