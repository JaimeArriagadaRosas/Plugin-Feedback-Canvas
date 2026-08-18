import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getPackageManagerCommand } from '../../src/preboot.js';

describe('preboot', () => {
  describe('getPackageManagerCommand', () => {
    it('should return correct command for non-Windows platforms (Linux/Unix)', () => {
      const manager = 'npm@11.8.0';
      const result = getPackageManagerCommand(manager, 'linux');

      assert.strictEqual(result.command, 'npx');
      assert.deepStrictEqual(result.args, [
        '--yes',
        manager,
        'ci',
        '--no-fund',
        '--no-audit',
        '--loglevel=error'
      ]);
    });

    it('should return ComSpec/cmd.exe wrapper for Windows platform', () => {
      const manager = 'npm@11.8.0';
      const originalComSpec = process.env.ComSpec;
      process.env.ComSpec = 'C:\\Windows\\System32\\cmd.exe';

      const result = getPackageManagerCommand(manager, 'win32');

      assert.strictEqual(result.command, 'C:\\Windows\\System32\\cmd.exe');
      assert.deepStrictEqual(result.args, [
        '/d',
        '/c',
        'npx.cmd',
        '--yes',
        manager,
        'ci',
        '--no-fund',
        '--no-audit',
        '--loglevel=error'
      ]);

      // Restore
      if (originalComSpec !== undefined) {
        process.env.ComSpec = originalComSpec;
      } else {
        delete process.env.ComSpec;
      }
    });

    it('should fallback to cmd.exe if ComSpec is missing on Windows', () => {
      const manager = 'npm@11.8.0';
      const originalComSpec = process.env.ComSpec;
      delete process.env.ComSpec;

      const result = getPackageManagerCommand(manager, 'win32');

      assert.strictEqual(result.command, 'cmd.exe');
      
      // Restore
      if (originalComSpec !== undefined) {
        process.env.ComSpec = originalComSpec;
      }
    });
  });
});

import { after } from 'node:test';
after(() => {
  process.exit(0);
});
