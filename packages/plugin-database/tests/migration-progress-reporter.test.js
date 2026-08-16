import { describe, expect, it, vi } from 'vitest';

import { MigrationProgressReporter } from '../src/migrations/MigrationProgressReporter.js';

describe('MigrationProgressReporter', () => {
  it('updates a single line while interactive migrations are applied', () => {
    const output = { isTTY: true, write: vi.fn() };
    const reporter = new MigrationProgressReporter({ output });

    reporter.start(2);
    reporter.migrationStart(1, '001_initial_schema.sql');
    reporter.migrationStart(2, '002_lti_nonces.sql');
    reporter.complete();

    expect(output.write).toHaveBeenCalledWith('  · Applying 2 local migrations...\n');
    expect(output.write).toHaveBeenCalledWith('\u001B[2K\r  · Migration 2/2: 002_lti_nonces');
    expect(output.write).toHaveBeenLastCalledWith('\u001B[2K\r  √ Local migrations applied (2/2).\n');
  });

  it('reports compactly when there are no pending migrations', () => {
    const output = { isTTY: false, write: vi.fn() };
    const reporter = new MigrationProgressReporter({ output });

    reporter.noPending();

    expect(output.write).toHaveBeenCalledWith('  √ Local migrations up to date.\n');
  });
});
