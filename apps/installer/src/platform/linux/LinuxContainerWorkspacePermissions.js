export class LinuxContainerWorkspacePermissions {
  constructor({ runner }) {
    this.runner = runner;
  }

  async prepare({ canvasDir, logFile, boot }) {
    const traversal = await this.runner('docker', [
      'compose', 'exec', '-T', '--user', 'root', 'web', 'chmod', 'o+x', '/home/docker'
    ], { cwd: canvasDir, logFile });
    if (!traversal.success) {
      boot.error(`Could not enable gems cache access: ${traversal.err}`);
      return null;
    }
    return [
      '--user', 'root',
      '-e', 'HOME=/tmp',
      '-e', 'BUNDLE_USER_PLUGIN=/home/docker/.bundle/plugin'
    ];
  }
}
