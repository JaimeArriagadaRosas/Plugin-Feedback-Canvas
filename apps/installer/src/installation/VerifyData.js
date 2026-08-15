import { runCommand } from './utils/Runner.js';
import { createSpinner } from 'nanospinner';

export class VerifyData {
  constructor(boot, canvasDir) {
    this.boot = boot;
    this.canvasDir = canvasDir;
  }

  async isDataPopulated(maxRetries = 12, waitSeconds = 5) {
    this.boot.info('Verifying the existence of the University database (Courses, Users)...');
    
    // Check if web container is up
    const { success: webUp, out: webOut } = await runCommand('docker', ['compose', 'ps', '-q', 'web'], { cwd: this.canvasDir, captureAll: true });
    if (!webUp || !webOut.trim()) {
      this.boot.error("The Canvas 'web' container is not running. Cannot verify the DB.");
      return false;
    }

    const sqlCheck = "SELECT 1 FROM users LIMIT 1;";
    const spinner = createSpinner('Verifying institutional data (pure SQL)...').start();

    // Increased to 12 retries to avoid early failures during heavy initialization
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { success, out, err } = await runCommand('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'canvas_development', '-tAc', sqlCheck], { 
        cwd: this.canvasDir,
        timeout: 15000, // 15 seconds max for psql
        captureAll: true
      });

      if (err && ((err.includes('relation') && err.includes('does not exist')) || (err.includes('database') && err.includes('does not exist')))) {
        spinner.error({ text: 'The database is not migrated or the users table does not exist.', mark: '  ×' });
        this.boot.error('The Canvas database is not initialized. Run migrations.');
        return false;
      }

      if (success) {
        if (out.trim() === '1') {
          spinner.success({ text: 'Base institutional data found in Canvas.', mark: '  √' });
          return true;
        } else {
          spinner.warn({ text: 'Base institutional data is not installed.', mark: '  !' });
          return false;
        }
      }

      this.boot.debug(`Attempt ${attempt} failed for Base Data. Out: ${out}, Err: ${err}`);
      
      if (attempt < maxRetries) {
        spinner.update({ text: `Verifying institutional data... (Attempt ${attempt + 1}/${maxRetries})` });
        await new Promise(r => setTimeout(r, waitSeconds * 1000));
      }
    }

    spinner.error({ text: 'Base institutional data is not installed.', mark: '  !' });
    return false;
  }
}
