import {describe,it,expect,vi,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({stopBackend:vi.fn(),stopVite:vi.fn(),boot:{stage:vi.fn(),info:vi.fn(),warn:vi.fn(),success:vi.fn(),endStage:vi.fn()}}));
vi.mock('../../src/orchestration/process.js',()=>({stopBackend:mocks.stopBackend,stopVite:mocks.stopVite}));
vi.mock('../../src/orchestration/boot/logger.js',()=>({boot:mocks.boot}));
import {setupGracefulShutdown} from '../../src/orchestration/shutdown_utils.js';
afterEach(()=>{process.removeAllListeners('SIGINT');process.removeAllListeners('SIGTERM');vi.restoreAllMocks();mocks.stopBackend.mockReset();mocks.stopVite.mockReset()});
describe('early startup cancellation',()=>{
 it('cleans resources via late-bound callbacks and returns 130 before startup',async()=>{
  const backend={pid:123},proxy={stopTlsProxy:vi.fn().mockResolvedValue()};
  mocks.stopBackend.mockResolvedValue();mocks.stopVite.mockResolvedValue();
  const exit=vi.spyOn(process,'exit').mockImplementation(code=>{throw Error('EXIT_'+code)});
  const stop=setupGracefulShutdown(()=>backend,()=>proxy,{isStarted:()=>false});
  await expect(stop()).rejects.toThrow('EXIT_130');
  expect(proxy.stopTlsProxy).toHaveBeenCalledOnce();
  expect(mocks.stopBackend).toHaveBeenCalledWith(backend);
  expect(exit).toHaveBeenCalledWith(130);
 });
 it('startup failure exits 1',async()=>{
  mocks.stopBackend.mockResolvedValue();mocks.stopVite.mockResolvedValue();
  vi.spyOn(process,'exit').mockImplementation(code=>{throw Error('EXIT_'+code)});
  const stop=setupGracefulShutdown(()=>null,()=>null,{isStarted:()=>false});
  await expect(stop({failure:true})).rejects.toThrow('EXIT_1');
 });
});
