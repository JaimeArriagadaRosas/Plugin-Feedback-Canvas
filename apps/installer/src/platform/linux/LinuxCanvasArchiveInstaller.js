export class LinuxCanvasArchiveInstaller {
  constructor({ runner }) {
    this.runner = runner;
  }

  async downloadAndExtract({ url, zipFile, destinationDir, logFile }) {
    const download = await this.runner('curl', [
      '--fail', '--location', '--retry', '3', '--output', zipFile, url
    ], { logFile });
    if (!download.success) return false;

    const extract = await this.runner('unzip', ['-q', zipFile, '-d', destinationDir], { logFile });
    return extract.success;
  }
}
