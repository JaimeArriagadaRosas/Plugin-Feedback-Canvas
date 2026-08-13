const CANVAS_WORKSPACE_ARGS = [
  '--user', 'root',
  '-e', 'HOME=/tmp',
  '-e', 'BUNDLE_USER_PLUGIN=/home/docker/.bundle/plugin'
];

export function withCanvasWorkspaceContext(commandArgs) {
  const execIndex = commandArgs.indexOf('exec');
  if (execIndex < 0 || commandArgs.includes('--user')) return commandArgs;
  return [
    ...commandArgs.slice(0, execIndex + 2),
    ...CANVAS_WORKSPACE_ARGS,
    ...commandArgs.slice(execIndex + 2)
  ];
}
