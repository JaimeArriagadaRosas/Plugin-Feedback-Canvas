import fs from 'node:fs';
import path from 'node:path';
import { run, requireSuccess } from '../runner.js';
function parseJSON(value, label) { try { return JSON.parse(value); } catch { throw new Error('Respuesta JSON inválida de ' + label); } }
export async function inspectDocker(root, canvas) {
  const runtime = await run('docker', ['info', '--format', '{{json .}}'], { timeout: 12000 });
  if (!runtime.ok) return { available: false, error: runtime.stderr, projects: [] };
  const info = parseJSON(runtime.stdout, 'docker info');
  const context = requireSuccess(await run('docker', ['context', 'show']), 'Contexto Docker').stdout;
  // Los nombres fijos del plugin pueden pertenecer a otra copia del monorepo.
  // En tal caso no se deben limpiar ni reutilizar silenciosamente.
  for (const fixed of ['feedback_plugin_db_local', 'feedback_plugin_gotenberg_local']) {
    const found = await run('docker', ['inspect', '--type', 'container', fixed]);
    if (!found.ok) continue;
    const container = parseJSON(found.stdout, 'Docker container')[0];
    const owner = container.Config?.Labels?.['com.docker.compose.project.working_dir'];
    if (!owner || path.resolve(owner) !== path.resolve(root)) {
      throw new Error('Contenedor con nombre compartido ' + fixed + ' pertenece a otro workspace o su propietario no está verificado. No se limpiará automáticamente.');
    }
  }
  const projects = [];
  for (const [name, dir, file] of [['plugin', root, 'docker-compose.db.yml'], ['canvas', canvas, 'docker-compose.yml']]) {
    if (!fs.existsSync(path.join(dir, file))) continue;
    const cfg = await run('docker', ['compose', '-f', file, 'config', '--format', 'json'], { cwd: dir, timeout: 15000 });
    if (!cfg.ok) throw new Error('Compose de ' + name + ': ' + cfg.stderr);
    const config = parseJSON(cfg.stdout, 'Compose');
    const projectName = config.name;
    if (!projectName || !/^[a-zA-Z0-9_-]+$/.test(projectName)) throw new Error('Nombre Compose inválido');
    const list = requireSuccess(await run('docker', ['ps', '-aq', '--filter', 'label=com.docker.compose.project=' + projectName]), 'Contenedores Compose');
    const containers = [];
    for (const id of list.stdout.split(/\s+/).filter(Boolean)) {
      const raw = requireSuccess(await run('docker', ['inspect', id]), 'Contenedor Docker').stdout;
      const c = parseJSON(raw, 'docker inspect')[0];
      const labels = c.Config?.Labels || {};
      const workingDir = labels['com.docker.compose.project.working_dir'];
      const configFiles = labels['com.docker.compose.project.config_files'] || '';
      if (workingDir !== dir || !configFiles.split(',').some(f => path.resolve(f) === path.join(dir, file))) continue;
      containers.push({ id, name: c.Name, running: c.State?.Running === true });
    }
    const volumes = [];
    const volumeIds = requireSuccess(await run('docker', ['volume', 'ls', '-q', '--filter', 'label=com.docker.compose.project=' + projectName]), 'Volúmenes Compose');
    for (const volume of volumeIds.stdout.split(/\s+/).filter(Boolean)) {
      const meta = parseJSON(requireSuccess(await run('docker', ['volume', 'inspect', volume]), 'Volumen').stdout, 'volumen')[0];
      if (meta.Labels?.['com.docker.compose.project'] !== projectName) continue;
      const attached = requireSuccess(await run('docker', ['ps', '-aq', '--filter', 'volume=' + volume]), 'Referencias de volumen').stdout.split(/\s+/).filter(Boolean);
      const exclusive = attached.every(id => containers.some(c => c.id === id));
      volumes.push({ name: volume, exclusive, attached: attached.length });
    }
    projects.push({ name, dir, file, projectName, containers, volumes });
  }
  return { available: true, rootless: (info.SecurityOptions || []).some(s => String(s).includes('rootless')), context, projects };
}
