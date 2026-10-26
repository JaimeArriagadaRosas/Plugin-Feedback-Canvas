import {describe,it,expect,vi,afterEach} from 'vitest';
import {EventEmitter} from 'node:events';
import {stopBackend} from '../../src/orchestration/process.js';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
const fakeChild=()=>{
 const child=new EventEmitter();
 child.pid=92731;child.exitCode=null;child.signalCode=null;
 child.kill=vi.fn(()=>true);
 return child;
};
describe('bounded child shutdown (no real PIDs signalled)',()=>{
 it('exits cooperatively after first SIGINT',async()=>{
   vi.useFakeTimers();
   const child=fakeChild();
   const done=stopBackend(child);
   expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGINT');
   child.emit('exit',0);
   await expect(done).resolves.toBeUndefined();
   await vi.advanceTimersByTimeAsync(6000);
   expect(child.kill).toHaveBeenCalledTimes(1);
 });
 it('escalates to SIGTERM when SIGINT is ignored',async()=>{
   vi.useFakeTimers();
   const child=fakeChild();
   const done=stopBackend(child);
   await vi.advanceTimersByTimeAsync(3500);
   expect(child.kill).toHaveBeenNthCalledWith(2,'SIGTERM');
   child.emit('exit',0);
   await done;
 });
 it('escalates to SIGKILL if SIGTERM also fails and resolves cleanup',async()=>{
   vi.useFakeTimers();
   const child=fakeChild();
   const done=stopBackend(child);
   await vi.advanceTimersByTimeAsync(4700);
   expect(child.kill).toHaveBeenNthCalledWith(3,'SIGKILL');
   await expect(done).resolves.toBeUndefined();
 });
 it('an already exited child is never signalled',async()=>{
   const child=fakeChild();child.exitCode=0;
   await stopBackend(child);
   expect(child.kill).not.toHaveBeenCalled();
 });
});
