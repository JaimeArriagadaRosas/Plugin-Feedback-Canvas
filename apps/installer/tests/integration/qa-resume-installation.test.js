import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentSetup } from '../../src/installation/EnvironmentSetup.js';
import { PreflightChecks } from '../../src/installation/PreflightChecks.js';

const snapshots=[];
const roots=[];
function setup() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'qa-canvas-resume-'));
  roots.push(root);
  const plugin=path.join(root,'plugin');
  const canvas=path.join(root,'canvas');
  fs.mkdirSync(plugin);
  const marker=path.join(plugin,'.setup_complete');
  fs.writeFileSync(marker,'partial-install');
  const logger={ info:vi.fn(),warn:vi.fn(),success:vi.fn(),error:vi.fn(),action:vi.fn() };
  const dockerInstaller={getRuntimeState:vi.fn().mockResolvedValue({
    daemonAvailable:true,composeAvailable:true,cliOrigin:'local'
  })};
  return {root,plugin,canvas,marker,logger,dockerInstaller};
}
afterEach(()=>{
  vi.restoreAllMocks();
  const previous=snapshots.pop();
  if (previous === undefined) delete process.env.FAST_BOOT;
  else process.env.FAST_BOOT=previous;
  for (const dir of roots.splice(0)) fs.rmSync(dir,{recursive:true,force:true});
});
describe('Canvas installer: real orchestration with isolated failure-and-resume fixtures',()=>{
  it('reanuda tras interrupción con Canvas ausente sin Fast Boot falso ni destrucción de datos parciales',async()=>{
    snapshots.push(process.env.FAST_BOOT);
    process.env.FAST_BOOT='true';
    const x=setup();
    const install=new EnvironmentSetup(x.logger,x.plugin,x.canvas,{
      dockerInstallerFactory:()=>x.dockerInstaller,confirm:vi.fn()
    });
    const checks=vi.spyOn(PreflightChecks.prototype,'runChecks').mockResolvedValue({
      allOk:false,missing:{missing_canvas_clone:true}
    });
    const provision=vi.spyOn(install,'_provisionMissing');
    const postflight=vi.spyOn(install,'_verifyPostInstall').mockResolvedValue(undefined);
    const bringup=vi.spyOn(install,'_bringupAndVerify').mockResolvedValue(undefined);
    provision.mockImplementationOnce(async()=>{
      fs.mkdirSync(x.canvas);
      fs.writeFileSync(path.join(x.canvas,'partial-config.yml'),'preserve-me');
      throw new Error('QA simulated power interruption');
    });
    await expect(install.ensureSetup()).rejects.toThrow('QA simulated power interruption');
    expect(fs.existsSync(x.marker)).toBe(false);
    expect(process.env.FAST_BOOT).toBe('false');
    expect(fs.readFileSync(path.join(x.canvas,'partial-config.yml'),'utf8')).toBe('preserve-me');
    expect(postflight).not.toHaveBeenCalled();
    expect(bringup).not.toHaveBeenCalled();
    provision.mockImplementationOnce(async(_missing,profile)=>{
      fs.writeFileSync(path.join(x.canvas,'assets-ready.txt'),'ok');
      return profile;
    });
    await expect(install.ensureSetup()).resolves.toBe(true);
    expect(fs.readFileSync(path.join(x.canvas,'partial-config.yml'),'utf8')).toBe('preserve-me');
    expect(checks).toHaveBeenCalledTimes(2);
    expect(provision).toHaveBeenCalledTimes(2);
    expect(postflight).toHaveBeenCalledOnce();
    expect(bringup).toHaveBeenCalledOnce();
    expect(x.logger.success).toHaveBeenCalled();
  });

  it('Fast Boot válido no borra marcador cuando servicios requieren chequeos',async()=>{
    snapshots.push(process.env.FAST_BOOT);
    process.env.FAST_BOOT='true';
    const x=setup();
    fs.mkdirSync(x.canvas);
    fs.writeFileSync(path.join(x.canvas,'project.yml'),'untouched');
    const install=new EnvironmentSetup(x.logger,x.plugin,x.canvas,{
      dockerInstallerFactory:()=>x.dockerInstaller
    });
    vi.spyOn(PreflightChecks.prototype,'runChecks').mockResolvedValue({allOk:true,missing:{}});
    const bringup=vi.spyOn(install,'_bringupAndVerify').mockResolvedValue(undefined);
    await expect(install.ensureSetup()).resolves.toBe(true);
    expect(process.env.FAST_BOOT).toBe('true');
    expect(fs.readFileSync(x.marker,'utf8')).toBe('partial-install');
    expect(fs.readFileSync(path.join(x.canvas,'project.yml'),'utf8')).toBe('untouched');
    expect(bringup).toHaveBeenCalledOnce();
  });
});
