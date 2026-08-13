import { describe, expect, it, vi } from 'vitest';

import { MigrationProgressReporter } from '../src/migrations/MigrationProgressReporter.js';

describe('MigrationProgressReporter', () => {
  it('actualiza una sola línea mientras se aplican migraciones interactivas', () => {
    const output = { isTTY: true, write: vi.fn() };
    const reporter = new MigrationProgressReporter({ output });

    reporter.start(2);
    reporter.migrationStart(1, '001_initial_schema.sql');
    reporter.migrationStart(2, '002_lti_nonces.sql');
    reporter.complete();

    expect(output.write).toHaveBeenCalledWith('  · Aplicando 2 migraciones locales...\n');
    expect(output.write).toHaveBeenCalledWith('\u001B[2K\r  · Migración 2/2: 002_lti_nonces');
    expect(output.write).toHaveBeenLastCalledWith('\u001B[2K\r  √ Migraciones locales aplicadas (2/2).\n');
  });

  it('informa de forma compacta cuando no hay migraciones pendientes', () => {
    const output = { isTTY: false, write: vi.fn() };
    const reporter = new MigrationProgressReporter({ output });

    reporter.noPending();

    expect(output.write).toHaveBeenCalledWith('  √ Migraciones locales al día.\n');
  });
});
