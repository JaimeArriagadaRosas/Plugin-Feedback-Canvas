import { runCommand } from '../utils/Runner.js';
import { createSpinner } from 'nanospinner';

export class RubyDependencyInstaller {
  constructor(boot, canvasDir) {
    this.boot = boot;
    this.canvasDir = canvasDir;
  }

  async ensureBundlerPlugins() {
    this.boot.info('Verificando plugins de Bundler necesarios...');
    
    const { success, out, err } = await runCommand(
      'docker', 
      ['compose', 'exec', '-T', 'web', 'bundle', 'plugin', 'list'], 
      { cwd: this.canvasDir, captureAll: true }
    );

    const hasMultilock = out.includes('bundler-multilock') || err.includes('bundler-multilock');
    
    if (!hasMultilock) {
      this.boot.info('Instalando bundler-multilock...');
      const spinner = createSpinner('Instalando plugin bundler-multilock...').start();
      
      const installResult = await runCommand(
        'docker',
        ['compose', 'exec', '-T', 'web', 'gem', 'install', 'bundler-multilock'],
        { cwd: this.canvasDir, timeout: 120000 }
      );
      
      if (!installResult.success) {
        spinner.error({ text: 'Falló la instalación de bundler-multilock.' });
        this.boot.error('Error al instalar bundler-multilock. Salida: ' + installResult.err);
        return false;
      }
      spinner.success({ text: 'bundler-multilock instalado correctamente.' });
    } else {
      this.boot.info('bundler-multilock ya está instalado.');
    }
    
    return true;
  }
}