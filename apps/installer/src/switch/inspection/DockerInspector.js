import { run } from '../runner.js';
export async function inspectDocker(root, canvas) {
  const runtime = await run('docker', ['info', '--format', '{{json .}}'], { timeout: 12000 });
  const context = await run('docker', ['context', 'show']);
  if (!runtime.ok) return { available: false, context: context.stdout || null, error: runtime.stderr, projects: [] };
  let info;
  try { info = JSON.parse(runtime.stdout); } catch { return { available: false, error: 'docker info devolvió JSON inválido', projects: [] }; }
  const projects = [];
  for (const [name, dir, file] of [
    ['plugin-db', root, 'docker-compose.db.yml'],
    ['canvas', canvas, 'docker-compose.yml']
  ]) {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    if (!existsSync(join(dir, file))) continue;
    const ids = await run('docker', ['compose', '-f', file, 'ps', '-q'], { cwd: dir });
    if (!ids.ok) { projects.push({ name, dir, file, ids: [], error: ids.stderr }); continue; }
    const owned = [];
    for (const id of ids.stdout.split(/\s+/).filter(Boolean)) {
      const label = await run('docker', ['inspect', '--format', '{{index .Config.Labels "com.docker.compose.project.working_dir"}}', id]);
      if (label.ok && label.stdout === dir) owned.push(id);
    }
    projects.push({ name, dir, file, ids: owned, count: owned.length });
  }
  return { available: true, context: context.stdout || '', rootless: (info.SecurityOptions || []).some(s => String(s).includes('rootless')), projects };
}
