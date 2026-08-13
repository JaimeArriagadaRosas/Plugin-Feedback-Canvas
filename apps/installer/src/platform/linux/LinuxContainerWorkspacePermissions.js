export class LinuxContainerWorkspacePermissions {
  constructor({ runner }) {
    this.runner = runner;
  }

  async prepare({ canvasDir, logFile, boot }) {
    const traversal = await this.runner('docker', [
      'compose', 'exec', '-T', '--user', 'root', 'web', 'chmod', 'o+x', '/home/docker'
    ], { cwd: canvasDir, logFile });
    if (!traversal.success) {
      boot.error(`No se pudo habilitar el acceso al cache de gems: ${traversal.err}`);
      return null;
    }
    return [
      '--user', 'root',
      '-e', 'HOME=/tmp',
      '-e', 'BUNDLE_USER_PLUGIN=/home/docker/.bundle/plugin'
    ];
  }
}
