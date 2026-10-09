import path from 'node:path';
import { boot } from '../orchestration/boot/logger.js';
import { getPluginDirectory } from '../installation/utils/LocalWorkspacePaths.js';
import { inspectGit } from './inspection/GitInspector.js';
import { inspectWorkspace } from './inspection/WorkspaceInspector.js';
import { inspectDocker } from './inspection/DockerInspector.js';
import { buildPlan } from './SwitchPlan.js';
import { confirmAction } from './SwitchPrompt.js';
import { prepareDocker } from './steps/Docker.js';
import { cleanArtifacts } from './steps/Artifacts.js';
import { changeBranch } from './steps/Git.js';
import { prepareDependencies } from './steps/Dependencies.js';
import { launch } from './steps/Launch.js';
export async function runSwitch() {
  const root = path.resolve(getPluginDirectory());
  boot.plain('=========================================================');
  boot.plain('  OPCIÓN 5 — CAMBIAR IDIOMA / RAMA');
  boot.plain('=========================================================');
  const git = await inspectGit(root);
  const workspace = inspectWorkspace(root);
  const docker = await inspectDocker(root, workspace.canvas);
  const plan = buildPlan({ git, workspace, docker });
  const ctx = { root, git, workspace, docker, plan };
  boot.info(`Rama actual: ${git.current} → destino: ${git.destination}`);
  boot.info(`Canvas LMS: ${workspace.canvasExists ? 'presente' : 'ausente'} (${workspace.canvas})`);
  boot.info(`Setup anterior: ${workspace.setupComplete ? 'detectado' : 'no detectado'}`);
  boot.info(`Docker: ${docker.available ? docker.context : 'no disponible'}`);
  boot.info(`Artefactos por limpiar: ${Object.entries(plan.cleanup).filter(([,v]) => v).map(([k]) => k).join(', ') || 'ninguno'}`);
  boot.warn('Los volúmenes, bases de datos y clon de Canvas NO se eliminarán. La configuración de idioma guardada dentro de Canvas podría requerir migración separada.');
  if (git.current === git.destination) { boot.info('Ya está en la rama solicitada.'); return; }
  if (!await confirmAction({ title: `Preparar cambio a ${git.destination}`, detail: 'Cada operación de limpieza solicitará una segunda autorización individual.' })) {
    boot.info('Cambio cancelado sin modificar el entorno.');
    return;
  }
  await prepareDocker(ctx);
  await cleanArtifacts(ctx);
  await changeBranch(ctx);
  await prepareDependencies(ctx);
  boot.success('Cambio de rama preparado. Los datos persistentes de Canvas se han conservado.');
  launch(ctx);
}
