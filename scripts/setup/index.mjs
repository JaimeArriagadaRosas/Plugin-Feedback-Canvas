import { Listr } from 'listr2';
import chalk from 'chalk';
import { execa } from 'execa';
import { manageEnv } from './env-manager.mjs';
import { checkAndStartDocker } from './docker-manager.mjs';
import { runMigrations } from './migrate.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

console.log(chalk.cyan.bold('\n🚀 Inicializando Configuración del Entorno (Multiplataforma)\n'));

let containerCli = 'docker';

const tasks = new Listr([
  {
    title: 'Validando dependencias del sistema y Node.js',
    task: () => {
      const nodeVersion = process.versions.node.split('.')[0];
      if (nodeVersion < 18) {
        throw new Error('Se requiere Node.js v18 o superior.');
      }
    }
  },
  {
    title: 'Configurando Variables de Entorno (.env)',
    task: async () => await manageEnv()
  },
  {
    title: 'Detectando y Arrancando Motor de Contenedores',
    task: async (ctx, task) => {
      containerCli = await checkAndStartDocker();
      task.title = `Motor de contenedores activo: ${containerCli}`;
    }
  },
  {
    title: 'Levantando Infraestructura Local (Base de Datos)',
    task: async () => {
      // Usar compose-plugin de docker (docker compose) o podman-compose
      const args = containerCli === 'docker' ? ['compose', 'up', '-d', '--wait'] : ['compose', 'up', '-d'];
      await execa(containerCli, ['-f', 'docker-compose.db.yml', ...args], { cwd: ROOT_DIR });
      
      if (containerCli !== 'docker') {
        // Podman no soporta siempre --wait, así que esperamos unos segundos
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  },
  {
    title: 'Ejecutando Migraciones (PostgreSQL)',
    task: async () => {
      await runMigrations();
    }
  }
], {
  exitOnError: true,
  rendererOptions: { collapse: false }
});

try {
  await tasks.run();
  console.log(chalk.green.bold('\n✅ ¡Entorno configurado correctamente!'));
  console.log(chalk.white(`
🌐 Puedes iniciar el servidor de desarrollo ejecutando:
   ${chalk.cyan('npm run dev')}

📂 Los servicios están expuestos en los siguientes puertos:
   - PostgreSQL (Plugin): ${chalk.yellow('5432')}
   - Servidor Plugin: ${chalk.yellow('3000')} (o el configurado en tu .env)
`));
} catch (err) {
  console.error(chalk.red('\n❌ Ocurrió un error durante la configuración:\n'), err);
  process.exit(1);
}
