import {describe,it,expect,vi,beforeEach} from 'vitest';

const mocks=vi.hoisted(()=>({runChecks:vi.fn(),plan:vi.fn()}));
vi.mock('../../src/installation/PreflightChecks.js',()=>({PreflightChecks:class{runChecks(){return mocks.runChecks();}}}));
vi.mock('../../src/recovery/SharedDependencyRecovery.js',()=>({SharedDependencyRecovery:class{plan(){return mocks.plan();}}}));
import {EnvironmentSetup} from '../../src/installation/EnvironmentSetup.js';

const boot={info:vi.fn()};
const build=()=>new EnvironmentSetup(boot,'/plugin','/canvas');
beforeEach(()=>{vi.clearAllMocks();mocks.plan.mockResolvedValue({kind:'reuse'});});

describe('full startup postflight verification',()=>{
 it('healthy clean boot never activates recovery',async()=>{
  mocks.runChecks.mockResolvedValue({allOk:true,missing:{}});
  await expect(build()._verifyPostInstall()).resolves.toBeUndefined();
  expect(mocks.plan).not.toHaveBeenCalled();
 });
 it('compatible services of another checkout pass second verification',async()=>{
  mocks.runChecks.mockResolvedValue({allOk:false,missing:{plugin_db_status:'missing',gotenberg_status:'missing'}});
  await expect(build()._verifyPostInstall()).resolves.toBeUndefined();
  expect(mocks.plan).toHaveBeenCalledTimes(1);
 });
 it('unrelated missing startup component remains fatal',async()=>{
  mocks.runChecks.mockResolvedValue({allOk:false,missing:{missing_canvas_clone:true,plugin_db_status:'missing'}});
  await expect(build()._verifyPostInstall()).rejects.toThrow(/Post-installation verification failed/);
  expect(mocks.plan).not.toHaveBeenCalled();
 });
 it('unhealthy shared containers cannot be used to bypass postflight',async()=>{
  mocks.runChecks.mockResolvedValue({allOk:false,missing:{plugin_db_status:'missing'}});
  mocks.plan.mockResolvedValue({kind:'block'});
  await expect(build()._verifyPostInstall()).rejects.toThrow(/Post-installation verification failed/);
 });
});
