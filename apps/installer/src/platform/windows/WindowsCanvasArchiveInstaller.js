function quotePowerShell(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export class WindowsCanvasArchiveInstaller {
  constructor({ runner }) {
    this.runner = runner;
  }

  async downloadAndExtract({ url, zipFile, destinationDir, logFile }) {
    const download = await this.runner('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Invoke-WebRequest -Uri ${quotePowerShell(url)} -OutFile ${quotePowerShell(zipFile)}`
    ], { logFile });
    if (!download.success) return false;

    const extract = await this.runner('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -LiteralPath ${quotePowerShell(zipFile)} -DestinationPath ${quotePowerShell(destinationDir)}`
    ], { logFile });
    return extract.success;
  }
}
