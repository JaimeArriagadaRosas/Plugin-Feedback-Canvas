import path from 'node:path';
import { boot } from '../orchestration/boot/logger.js';
import { getPluginDirectory } from '../installation/utils/LocalWorkspacePaths.js';
import { inspectGit } from './inspection/GitInspector.js';
import { inspectWorkspace } from './inspection/WorkspaceInspector.js';
import { inspectDocker } from './inspection/DockerInspector.js';
import { buildPlan } from './SwitchPlan.js';
import { confirmAction } from './SwitchPrompt.js';
import { SwitchState } from './SwitchState.js';
import { prepareDocker } from './steps/Docker.js';
import { cleanProcesses } from './steps/Processes.js';
import { cleanArtifacts } from './steps/Artifacts.js';
import { changeBranch } from './steps/Git.js';
import { fastForwardDestination } from './steps/BranchFastForward.js';
import { prepareDependencies } from './steps/Dependencies.js';
import { prepareLocale } from './steps/Locale.js';
import { restartMenu } from './steps/RestartMenu.js';
export async function runSwitch() {
  const root = path.resolve(getPluginDirectory());
  const git = await inspectGit(root);
  const workspace = inspectWorkspace(root);
  const docker = await inspectDocker(root, workspace.canvas);
  if (!docker.available) throw new Error('Docker no está disponible. No puede verificarse si quedan contenedores y bases de datos anteriores. La transición no comenzará.');
  const plan = buildPlan({ git, workspace, docker });
  const ctx = { root, git, workspace, docker, plan };
  const state = new SwitchState(root, git.current, git.destination);
  await state.stage('inspected');
  boot.plain('================= OPCIÓN 5: CAMBIO A INGLÉS =================');
  boot.info('Origen: ' + git.current + ' | destino: ' + git.destination);
  boot.info('Canvas presente: ' + workspace.canvasExists + ' | proyectos Docker: ' + plan.projects.length);
  boot.warn('Cada limpieza solicita autorización individual. Los datos de los volúmenes aprobados se perderán definitivamente.');
  if (!await confirmAction({ title: 'Comenzar transición controlada', detail: 'La inspección terminó. Las operaciones siguientes solicitan Sí/No individual.' })) {
    await state.stage('cancelled', 'cancelled'); return;
  }
  try {
    await state.stage('git-destination');
    await fastForwardDestination(ctx);
    await state.stage('processes');
    await cleanProcesses(ctx);
    await state.stage('docker');
    await prepareDocker(ctx);
    await state.stage('artifacts');
    await cleanArtifacts(ctx);
    await state.stage('locale');
    await prepareLocale(ctx);
    if (plan.dependencies && !await confirmAction({ title: 'Reconstruir dependencias npm', detail: 'El nuevo lockfile requiere reinstalación de node_modules (npm ci).' })) throw new Error('Preparación npm rechazada.');
    await state.stage('git');
    await changeBranch(ctx);
    await state.stage('dependencies');
    await prepareDependencies(ctx);
    await state.stage('menu-ready', 'completed');
    boot.success('Cambio completado. El siguiente menú será de la rama inglesa; no se iniciará Canvas.');
    restartMenu(ctx, state);
  } catch(error) { await state.stage('error', 'failed'); throw error; }
}
