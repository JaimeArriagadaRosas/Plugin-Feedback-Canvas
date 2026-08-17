import { runCommand } from '../utils/Runner.js';
import { createSpinner } from 'nanospinner';

export class RubyDependencyInstaller {
  constructor(boot, canvasDir) {
    this.boot = boot;
    this.canvasDir = canvasDir;
  }

  async ensureBundlerPlugins() {
    this.boot.info('Verifying required Bundler plugins...');
    
    const { success, out, err } = await runCommand(
      'docker', 
      ['compose', 'exec', '-T', 'web', 'bundle', 'plugin', 'list'], 
      { cwd: this.canvasDir, captureAll: true }
    );

    const hasMultilock = out.includes('bundler-multilock') || err.includes('bundler-multilock');
    
    if (!hasMultilock) {
      this.boot.info('Installing bundler-multilock...');
      const spinner = createSpinner('Installing bundler-multilock plugin...').start();
      
      const installResult = await runCommand(
        'docker',
        ['compose', 'exec', '-T', 'web', 'gem', 'install', 'bundler-multilock'],
        { cwd: this.canvasDir, timeout: 120000 }
      );
      
      if (!installResult.success) {
        spinner.error({ text: 'Failed to install bundler-multilock.' });
        this.boot.error('Error installing bundler-multilock. Output: ' + installResult.err);
        return false;
      }
      spinner.success({ text: 'bundler-multilock instalado correctamente.' });
    } else {
      this.boot.info('bundler-multilock is already installed.');
    }
    
    return true;
  }
}