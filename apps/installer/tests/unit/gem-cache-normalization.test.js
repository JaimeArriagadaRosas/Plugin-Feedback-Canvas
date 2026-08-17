import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AssetBuilder } from '../../src/installation/installers/AssetBuilder.js';
import { analyzeLogAndDiagnose } from '../../src/installation/utils/Diagnostics.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Gem Cache Normalization and Retries', () => {
  it('ejecuta la instalación del plugin antes de la validación y la validación justo antes de bundle install', () => {
    const builder = new AssetBuilder({ info: vi.fn(), warn: vi.fn() }, null, '/canvas');
    const steps = builder._buildSteps();

    const pluginStepIndex = steps.findIndex(([command]) => command.includes('plugin') && command.includes('install'));
    const normalizationStepIndex = steps.findIndex(([command]) => {
      const script = command[command.length - 1];
      return script && script.includes('find "/home/docker/.gem"') && script.includes('INSECURE_REMAINING');
    });
<<<<<<< HEAD
    const bundleInstallStepIndex = steps.findIndex(([command]) => command.includes('bundle') && command.includes('install') && !command.includes('plugin'));
=======
    const bundleInstallStepIndex = steps.findIndex(([command]) => {
      return command.includes('bash') && command.includes('-c') && command.some(arg => typeof arg === 'string' && arg.includes('bundle install'));
    });
>>>>>>> 912eae8 (fix: execute bundle install wrapped in bash with umask 0022)

    expect(pluginStepIndex).toBeGreaterThan(-1);
    expect(normalizationStepIndex).toBeGreaterThan(-1);
    expect(bundleInstallStepIndex).toBeGreaterThan(-1);

    expect(pluginStepIndex).toBeLessThan(normalizationStepIndex);
    expect(normalizationStepIndex).toBe(bundleInstallStepIndex - 1);
  });

  it('abortar retries inmediatamente si el error es de permisos inseguros', async () => {
    const runner = vi.fn().mockResolvedValue({ success: false, code: 1, out: 'world-writable and does not have the sticky bit set', err: '' });
    const boot = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const builder = new AssetBuilder(boot, '/dev/null', '/canvas', { runner });

    // Mock _waitForRetry to avoid waiting in tests
    builder._waitForRetry = vi.fn().mockResolvedValue();
    builder._printDiagnosis = vi.fn();

    await builder._runLogged(['command'], 'Start', 'Fail', 'Success', 5);

    // Debe correr solo 1 vez y abortar porque es non-retryable
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('mantiene retries para errores transitorios', async () => {
    const runner = vi.fn().mockResolvedValue({ success: false, code: 1, out: 'some random error', err: '' });
    const boot = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const builder = new AssetBuilder(boot, '/dev/null', '/canvas', { runner });

    builder._waitForRetry = vi.fn().mockResolvedValue();
    builder._printDiagnosis = vi.fn();

    await builder._runLogged(['command'], 'Start', 'Fail', 'Success', 2);

    // Debe intentar el primer run + 2 retries = 3 veces
    expect(runner).toHaveBeenCalledTimes(3);
  });
<<<<<<< HEAD
=======

  it('usa bash -c, umask 0022, BUNDLE_FROZEN=false y --jobs=2 para bundle install', () => {
    const builder = new AssetBuilder({ info: vi.fn(), warn: vi.fn() }, null, '/canvas');
    const steps = builder._buildSteps();
    const bundleInstallStep = steps.find(([command]) => {
      return command.includes('bash') && command.includes('-c') && command.some(arg => typeof arg === 'string' && arg.includes('bundle install'));
    });
    
    expect(bundleInstallStep).toBeDefined();
    const cmd = bundleInstallStep[0];
    
    // Check environment variable
    expect(cmd.includes('-e')).toBe(true);
    expect(cmd.includes('BUNDLE_FROZEN=false')).toBe(true);
    
    // Check bash wrapping and script content
    const script = cmd[cmd.length - 1];
    expect(script).toContain('umask 0022');
    expect(script).toContain('exec bundle install');
    expect(script).toContain('--jobs=2');
  });
>>>>>>> 912eae8 (fix: execute bundle install wrapped in bash with umask 0022)
});

describe('Diagnostics - Bundler and Gem Cache', () => {
  function testDiagnosis(logContent, expectedType) {
    const filename = path.join(os.tmpdir(), `test-diag-${Date.now()}-${Math.random()}.log`);
    fs.writeFileSync(filename, logContent);
    try {
      const result = analyzeLogAndDiagnose(filename);
      expect(result).toMatchObject({ type: expectedType });
    } finally {
      fs.rmSync(filename, { force: true });
    }
  }

  it('diagnostica chmod fallido como CANVAS_GEM_CACHE_INSECURE_PERMISSIONS', () => {
    testDiagnosis('INSECURE_CHMOD_FAILED:/home/docker/.gem/insecure', 'CANVAS_GEM_CACHE_INSECURE_PERMISSIONS');
  });

  it('diagnostica directorio residual inseguro como CANVAS_GEM_CACHE_INSECURE_PERMISSIONS', () => {
    testDiagnosis('INSECURE_REMAINING:/home/docker/.gem/residual', 'CANVAS_GEM_CACHE_INSECURE_PERMISSIONS');
  });

  it('diagnostica la frase de Bundler world-writable and does not have the sticky bit set', () => {
    testDiagnosis('world-writable and does not have the sticky bit set, making it insecure to remove due to potential vulnerabilities.', 'CANVAS_GEM_CACHE_INSECURE_PERMISSIONS');
  });

  it('diagnostica la frase de Bundler unsafe to remove', () => {
    testDiagnosis('that is unsafe to remove.', 'CANVAS_GEM_CACHE_INSECURE_PERMISSIONS');
  });

  it('diagnostica INSECURE_SCAN_FAILED', () => {
    testDiagnosis('INSECURE_SCAN_FAILED:/home/docker/.gem', 'CANVAS_GEM_CACHE_INSECURE_PERMISSIONS');
  });
});

import { execSync } from 'node:child_process';

describe('Gem Cache Bash Normalization Script', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gem-cache-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runScript(fakeChmod = false, fakeFind = false) {
    const builder = new AssetBuilder({ info: vi.fn(), warn: vi.fn() }, null, '/canvas');
    const baseScript = builder._getGemCacheNormalizationScript(tmpDir);
    
    let scriptToRun = baseScript;
    if (fakeChmod) {
      scriptToRun = `chmod() { return 1; }; export -f chmod; ` + baseScript;
    } else if (fakeFind) {
      // the script runs `find ... | { ... }`, the second find is `find ... -print -quit`
      // To simulate scan failing without breaking the first loop, we can just replace the second find call
      // or we can make `find` fail depending on arguments.
      // But a simple alias might be easier. Let's make find return 1 always, which breaks both, meaning scan failed at the end or nothing was found initially.
      // Wait, if first find fails, while loop doesn't execute, but `exit $fail` is called.
      // Ah, `fail=0; ...; if [ $fail -eq 0 ]; then remaining=$(find ... -print -quit); if [ $? -ne 0 ]; ...`
      scriptToRun = `find() { return 1; }; export -f find; ` + baseScript;
    }

    try {
      const out = execSync(scriptToRun, { shell: '/bin/bash', encoding: 'utf8', stdio: 'pipe' });
      return { code: 0, output: out };
    } catch (err) {
      return { code: err.status, output: err.stdout + err.stderr };
    }
  }

  it('a) directorio 0777 corregible -> exit 0 y deja de ser world-writable', () => {
    const insecureDir = path.join(tmpDir, 'insecure');
    fs.mkdirSync(insecureDir);
    fs.chmodSync(insecureDir, 0o777);
    expect(fs.statSync(insecureDir).mode & 0o002).toBe(0o002);

    const result = runScript();
    expect(result.code).toBe(0);
    expect(result.output).not.toContain('INSECURE_');
    expect(fs.statSync(insecureDir).mode & 0o002).toBe(0);
  });

  it('b) chmod simulado como fallido -> exit != 0 e INSECURE_CHMOD_FAILED', () => {
    const insecureDir = path.join(tmpDir, 'insecure');
    fs.mkdirSync(insecureDir);
    fs.chmodSync(insecureDir, 0o777);

    const result = runScript(true, false);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('INSECURE_CHMOD_FAILED:' + insecureDir);
  });

  it('c) directorio que continúa inseguro después de la corrección -> exit != 0 e INSECURE_REMAINING', () => {
    const insecureDir = path.join(tmpDir, 'insecure');
    fs.mkdirSync(insecureDir);
    fs.chmodSync(insecureDir, 0o777);

    const builder = new AssetBuilder({ info: vi.fn(), warn: vi.fn() }, null, '/canvas');
    const baseScript = builder._getGemCacheNormalizationScript(tmpDir);
    // Simular que chmod reporta exito pero no hace nada
    const scriptWithFakeChmod = `chmod() { return 0; }; export -f chmod; ${baseScript}`;

    let result;
    try {
      const out = execSync(scriptWithFakeChmod, { shell: '/bin/bash', encoding: 'utf8', stdio: 'pipe' });
      result = { code: 0, output: out };
    } catch (err) {
      result = { code: err.status, output: err.stdout + err.stderr };
    }

    expect(result.code).not.toBe(0);
    expect(result.output).toContain('INSECURE_REMAINING:' + insecureDir);
  });

  it('d) fallo del scan/find -> exit != 0 e INSECURE_SCAN_FAILED', () => {
    const insecureDir = path.join(tmpDir, 'insecure');
    fs.mkdirSync(insecureDir);
    fs.chmodSync(insecureDir, 0o777);

    const result = runScript(false, true);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('INSECURE_SCAN_FAILED:' + tmpDir);
  });
});
