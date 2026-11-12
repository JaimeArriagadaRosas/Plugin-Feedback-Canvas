import { afterEach, describe, expect, it, vi } from 'vitest';
import { stripVTControlCharacters } from 'node:util';
import { BootLogger } from '../../src/orchestration/boot/logger.js';
import { PreflightChecks } from '../../src/installation/PreflightChecks.js';
import { EnvironmentSetup } from '../../src/installation/EnvironmentSetup.js';
import { CanvasBringup } from '../../src/installation/CanvasBringup.js';
import { PostflightSetup } from '../../src/installation/PostflightSetup.js';

afterEach(() => vi.restoreAllMocks());

function preflight(boot, outcomes = {}) {
  const checks = Object.create(PreflightChecks.prototype);
  checks.boot = boot;
  for (const name of ['checkDocker', 'checkDockerCompose', 'checkCanvasClone',
    'checkNode', 'checkNpm', 'checkPluginDb']) {
    checks[name] = vi.fn().mockImplementation(async () =>
      outcomes[name] || { ok: true, details: {} });
  }
  return checks;
}

describe('presentación de consola del instalador (sin alterar las comprobaciones)', () => {
  it('cierra cada uno de los seis progresos y conserva resultados y orden', async () => {
    const events = [];
    const boot = {
      info: vi.fn(msg => events.push(['info', msg])),
      plain: vi.fn(),
      beginInlineCheck: vi.fn(msg => events.push(['begin', msg])),
      endInlineCheck: vi.fn(() => events.push(['end'])),
      success: vi.fn(msg => events.push(['success', msg])),
      error: vi.fn()
    };
    const checks = preflight(boot);
    await expect(checks.runChecks()).resolves.toMatchObject({ allOk: true, missing: {} });
    expect(boot.beginInlineCheck).toHaveBeenCalledTimes(6);
    expect(boot.endInlineCheck).toHaveBeenCalledTimes(6);
    expect(events.filter(([type]) => type === 'success').map(([, msg]) => msg)).toEqual([
      '[1/6] Docker',
      '[2/6] Docker Compose',
      '[3/6] Canvas LMS',
      '[4/6] Node.js',
      '[5/6] NPM',
      '[6/6] Plugin Dependencies (DB/Gotenberg)'
    ]);
    for (const name of ['checkDocker', 'checkDockerCompose', 'checkCanvasClone',
      'checkNode', 'checkNpm', 'checkPluginDb']) {
      expect(checks[name]).toHaveBeenCalledTimes(1);
    }
    expect(events.slice(-2)).toEqual([['success',
      '[6/6] Plugin Dependencies (DB/Gotenberg)'],
      ['info', 'Component verification completed.']]);
  });

  it('no oculta errores y siempre cierra el progreso, aunque una comprobación falle', async () => {
    const boot = {
      info: vi.fn(), plain: vi.fn(), beginInlineCheck: vi.fn(),
      endInlineCheck: vi.fn(), success: vi.fn(), error: vi.fn()
    };
    const checks = preflight(boot, {
      checkPluginDb: {ok: false, details: {gotenberg_status: 'exited'}}
    });
    const result = await checks.runChecks();
    expect(result).toMatchObject({allOk: false, missing: {gotenberg_status: 'exited'}});
    expect(boot.endInlineCheck).toHaveBeenCalledTimes(6);
    expect(boot.error).toHaveBeenCalledWith('[6/6] Plugin Dependencies (DB/Gotenberg): unavailable');
    checks.checkPluginDb.mockRejectedValueOnce(new Error('fallo del servicio'));
    await expect(checks.runChecks()).rejects.toThrow('fallo del servicio');
    expect(boot.endInlineCheck).toHaveBeenCalledTimes(12);
  });

  it('un log dirigido a archivo conserva progreso, advertencias, errores y resultado', async () => {
    const stream = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const boot = new BootLogger();
    boot.beginInlineCheck('Verificando Gotenberg...');
    boot.warn('Servicio detenido');
    boot.error('No disponible');
    boot.success('[6/6] Plugin Dependencies (DB/Gotenberg)');
    const printed = stream.mock.calls.map(call => call[0]).join('');
    expect(printed).toContain('Verificando Gotenberg...');
    expect(printed).toContain('Servicio detenido');
    expect(printed).toContain('No disponible');
    expect(printed).toContain('[6/6] Plugin Dependencies');
  });

  it('el progreso de TTY se limpia antes de escribir una advertencia', () => {
    const own = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    const ownClear = Object.getOwnPropertyDescriptor(process.stdout, 'clearLine');
    const ownCursor = Object.getOwnPropertyDescriptor(process.stdout, 'cursorTo');
    const writer = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const clear = vi.fn(), cursor = vi.fn();
    try {
      Object.defineProperty(process.stdout, 'isTTY', {configurable: true, value: true});
      Object.defineProperty(process.stdout, 'clearLine', {configurable: true, value: clear});
      Object.defineProperty(process.stdout, 'cursorTo', {configurable: true, value: cursor});
      const boot = new BootLogger();
      boot.beginInlineCheck('[6/6] Verificando...');
      boot.warn('Error visible sin pérdida');
      boot.endInlineCheck();
      expect(clear).toHaveBeenCalledTimes(1);
      expect(cursor).toHaveBeenCalledTimes(1);
      expect(writer.mock.calls.map(call => call[0]).join('')).toContain('Error visible sin pérdida');
    } finally {
      if (own) Object.defineProperty(process.stdout, 'isTTY', own);
      else delete process.stdout.isTTY;
      if (ownClear) Object.defineProperty(process.stdout, 'clearLine', ownClear);
      else delete process.stdout.clearLine;
      if (ownCursor) Object.defineProperty(process.stdout, 'cursorTo', ownCursor);
      else delete process.stdout.cursorTo;
    }
  });

  it('presenta arranque y postflight sin cambiar el orden de las tareas', async () => {
    const order = [];
    const boot = {subsection: vi.fn(title => order.push('título ' + title))};
    vi.spyOn(CanvasBringup.prototype, 'bringup').mockImplementation(async () => {
      order.push('CanvasBringup'); return true;
    });
    vi.spyOn(PostflightSetup.prototype, 'runChecks').mockImplementation(async () => {
      order.push('PostflightSetup'); return true;
    });
    const setup = new EnvironmentSetup(boot, '/tmp/plugin', '/tmp/canvas');
    await setup._bringupAndVerify({});
    expect(order).toEqual([
      'título Canvas LMS startup',
      'CanvasBringup',
      'título Data validation and synchronization',
      'PostflightSetup'
    ]);
  });

  it('los subtítulos y sus mensajes conservan dos espacios, sin crear otro nivel', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const boot = new BootLogger();
    await boot.withStage('Verificación e instalación de Canvas LMS', async () => {
      expect(boot.stageStack).toHaveLength(1);
      boot.subsection('Canvas LMS startup');
      expect(boot.stageStack).toHaveLength(1);
      boot.info('Iniciando contenedores de Canvas LMS...');
      boot.subsection('Data validation and synchronization');
      expect(boot.stageStack).toHaveLength(1);
      boot.success('Datos institucionales encontrados');
    });
    const lines = stripVTControlCharacters(write.mock.calls.map(([message]) => message).join('')).split(/\r?\n/);
    expect(lines.some(line => /^  ── ▶ Canvas LMS startup/.test(line))).toBe(true);
    expect(lines.some(line => /^  ── ▶ Data validation and synchronization/.test(line))).toBe(true);
    expect(lines.some(line => /^  · Iniciando contenedores de Canvas LMS/.test(line))).toBe(true);
    expect(lines.some(line => /^  √ Datos institucionales encontrados/.test(line))).toBe(true);
    expect(lines.some(line => /^    (?:·|√)/.test(line))).toBe(false);
  });

  it('mantiene fallos de Canvas sin ejecutar el postflight', async () => {
    const boot = {subsection: vi.fn()};
    vi.spyOn(CanvasBringup.prototype, 'bringup').mockResolvedValue(false);
    const postflight = vi.spyOn(PostflightSetup.prototype, 'runChecks');
    const setup = new EnvironmentSetup(boot, '/tmp/plugin', '/tmp/canvas');
    await expect(setup._bringupAndVerify({})).rejects.toThrow('Canvas LMS bringup failed.');
    expect(postflight).not.toHaveBeenCalled();
    expect(boot.subsection).toHaveBeenCalledTimes(1);
  });
});
