import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { checkCanvasDatabasePreflight } from '../../src/installation/CanvasDatabasePreflight.js';
import { EnvironmentSetup } from '../../src/installation/EnvironmentSetup.js';
import { PreflightChecks } from '../../src/installation/PreflightChecks.js';

const dirs = [];
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-preflight-canvas-'));
  dirs.push(directory);
  return directory;
}
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.FAST_BOOT;
  dirs.splice(0).forEach(x => fs.rmSync(x, { recursive: true, force: true }));
});
function simulator(canvasDir, state='ready', mutate={}) {
  const id = 'abcdef0123456789abcdefff';
  const labels = {
    'com.docker.compose.project': 'qa-canvas-owned',
    'com.docker.compose.service': 'postgres',
    'com.docker.compose.project.working_dir': canvasDir,
    ...mutate,
  };
  const calls=[];
  const execute=vi.fn(async (command, args, options) => {
    calls.push({command,args,options});
    if (args[0] === 'compose') {
      return { success: true, out: state==='missing' ? '' : id+'\n' };
    }
    if (args[0] === 'inspect') {
      return { success: true, out: JSON.stringify({
        Config: {Labels: labels},
        State: {Running: state!=='stopped'}
      }) };
    }
    if (args[0]==='exec') {
      const catalog = Object.fromEntries(['accounts','terms','shards','migrations']
        .map(k => [k, state!=='schema_incomplete' || k!=='accounts']));
      return { success: state!=='unavailable', out: JSON.stringify(catalog)+'\n' };
    }
    throw new Error('Unexpected Docker operation');
  });
  return {execute,calls};
}

describe('Canvas preflight is strictly read-only and fail-closed', () => {
  it.each([
    ['ready','ready'],
    ['schema_incomplete','schema_incomplete'],
    ['stopped','stopped'],
    ['missing','missing'],
    ['unavailable','unavailable'],
  ])('classifies %s without starting/rebuilding containers',async (mode,expected) => {
    const cwd=fixture();
    const {execute,calls}=simulator(cwd,mode);
    expect((await checkCanvasDatabasePreflight(cwd,{execute})).state).toBe(expected);
    expect(calls.every(c=>c.command==='docker')).toBe(true);
    const args=calls.map(c=>c.args.join(' ')).join(' ');
    expect(args).not.toMatch(/compose up|compose down|docker start|restart|db:migrate|rm -|DROP TABLE|INSERT|UPDATE/i);
    if (mode==='stopped') expect(calls.map(c=>c.args[0])).toEqual(['compose','inspect']);
    if (mode==='ready') {
      expect(calls.at(-1).options.input).toContain('BEGIN TRANSACTION READ ONLY');
      expect(calls.at(-1).args).toContain('PGOPTIONS=-c default_transaction_read_only=on');
    }
  });

  it('blocks a container from a different Compose owner',async()=>{
    const cwd=fixture();
    const {execute,calls}=simulator(cwd,'ready',{
      'com.docker.compose.project.working_dir': '/tmp/foreign-canvas-owner'});
    expect((await checkCanvasDatabasePreflight(cwd,{execute})).state).toBe('identity_conflict');
    expect(calls.map(c=>c.args[0])).toEqual(['compose','inspect']);
  });

  it('blocks multiple or ambiguous container identifiers',async()=>{
    const cwd=fixture();
    const execute=vi.fn().mockResolvedValue({success:true,
      out:'abcdef0123456789abcdefff\naaaaaaaaaaaa\n'});
    expect((await checkCanvasDatabasePreflight(cwd,{execute})).state).toBe('identity_conflict');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects misleading or malformed SQL catalog output',async()=>{
    const cwd=fixture();
    const {execute}=simulator(cwd);
    const baseline=execute.getMockImplementation();
    execute.mockImplementation(async (...args) => {
      if (args[1][0] === 'exec') return {success:true,out:'NOTICE: {"accounts":true}\n'};
      return baseline(...args);
    });
    expect((await checkCanvasDatabasePreflight(cwd,{execute})).state).toBe('unavailable');
  });

  it.each(['canvas_database_incomplete','canvas_database_unverified'])(
    'blocks installation flow early for %s', async (missingKey)=>{
      const cwd=fixture();
      const log={info:vi.fn(),warn:vi.fn(),error:vi.fn(),success:vi.fn()};
      const installer={getRuntimeState:vi.fn().mockResolvedValue({daemonAvailable:true,composeAvailable:true})};
      const setup=new EnvironmentSetup(log,cwd,path.join(cwd,'canvas'),{
        dockerInstallerFactory:()=>installer
      });
      vi.spyOn(PreflightChecks.prototype,'runChecks').mockResolvedValue({
        allOk:false,missing:{[missingKey]:true}
      });
      const provision=vi.spyOn(setup,'_provisionMissing');
      const bringup=vi.spyOn(setup,'_bringupAndVerify');
      await expect(setup.ensureSetup()).rejects.toThrow('CANVAS-DB-PREFLIGHT-BLOCK');
      expect(provision).not.toHaveBeenCalled();
      expect(bringup).not.toHaveBeenCalled();
    });

  it('stopped own DB can proceed via normal bringup without triggering asset reconstruction',async()=>{
    const cwd=fixture();
    const log={info:vi.fn(),warn:vi.fn(),error:vi.fn(),success:vi.fn()};
    const setup=new EnvironmentSetup(log,cwd,path.join(cwd,'canvas'),{
      dockerInstallerFactory:()=>({getRuntimeState:async()=>({daemonAvailable:true})})
    });
    vi.spyOn(PreflightChecks.prototype,'runChecks').mockResolvedValue({allOk:true,missing:{}});
    const provision=vi.spyOn(setup,'_provisionMissing');
    const bringup=vi.spyOn(setup,'_bringupAndVerify').mockResolvedValue();
    await expect(setup.ensureSetup()).resolves.toBe(true);
    expect(provision).not.toHaveBeenCalled();
    expect(bringup).toHaveBeenCalledTimes(1);
  });
});
