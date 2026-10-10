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
import { prepareDependencies } from './steps/Dependencies.js';
import { prepareLocale } from './steps/Locale.js';
import { restartMenu } from './steps/RestartMenu.js';
export async function runSwitch() {
  const root = path.resolve(getPluginDirectory());
  const git = await inspectGit(root);
  const workspace = inspectWorkspace(root);
  const docker = await inspectDocker(root, workspace.canvas);
  if (!docker.available) throw new Error('Docker is unavailable. Existing containers and databases cannot be verified. The switch will not start.');
  const plan = buildPlan({ git, workspace, docker });
  const ctx = { root, git, workspace, docker, plan };
  const state = new SwitchState(root, git.current, git.destination);
  await state.stage('inspected');
  boot.plain('================= OPTION 5: SWITCH TO SPANISH =================');
  boot.info('Source: ' + git.current + ' | destination: ' + git.destination);
  boot.info('Canvas present: ' + workspace.canvasExists + ' | Docker projects: ' + plan.projects.length);
  boot.warn('Each cleanup requires separate approval. Data in approved volumes will be permanently deleted.');
  if (!await confirmAction({ title: 'Begin controlled language switch', detail: 'Inspection complete. Each subsequent action requires separate Yes/No approval.' })) {
    await state.stage('cancelled', 'cancelled'); return;
  }
  try {
    await state.stage('processes');
    await cleanProcesses(ctx);
    await state.stage('docker');
    await prepareDocker(ctx);
    await state.stage('artifacts');
    await cleanArtifacts(ctx);
    await state.stage('locale');
    await prepareLocale(ctx);
    if (plan.dependencies && !await confirmAction({ title: 'Reinstall npm dependencies', detail: 'The destination lockfile requires reinstalling node_modules (npm ci).' })) throw new Error('npm dependency preparation declined.');
    await state.stage('git');
    await changeBranch(ctx);
    await state.stage('dependencies');
    await prepareDependencies(ctx);
    await state.stage('menu-ready', 'completed');
    boot.success('Switch completed. The Spanish menu will now open.');
    restartMenu(ctx, state);
  } catch(error) { await state.stage('error', 'failed'); throw error; }
}
