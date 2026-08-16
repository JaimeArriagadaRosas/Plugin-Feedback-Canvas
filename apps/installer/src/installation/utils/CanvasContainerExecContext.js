export async function getCanvasWorkspaceArgs() {
  const { DockerInstaller } = await import('../installers/DockerInstaller.js');
  const { ContainerExecutionPolicy } = await import('../../platform/shared/ContainerExecutionPolicy.js');
  
  // Create a silent logger since this is a utility
  const silentLogger = {
    info: () => {}, warn: () => {}, error: () => {}, success: () => {}, action: () => {}
  };
  
  const installer = new DockerInstaller(silentLogger, '/dev/null');
  const profile = await installer.getRuntimeState();
  const policy = new ContainerExecutionPolicy(profile);
  return policy.getExecutionArgs();
}

export async function withCanvasWorkspaceContext(commandArgs) {
  const execIndex = commandArgs.indexOf('exec');
  if (execIndex < 0 || commandArgs.includes('--user')) return commandArgs;
  
  const workspaceArgs = await getCanvasWorkspaceArgs();
  return [
    ...commandArgs.slice(0, execIndex + 2),
    ...workspaceArgs,
    ...commandArgs.slice(execIndex + 2)
  ];
}
