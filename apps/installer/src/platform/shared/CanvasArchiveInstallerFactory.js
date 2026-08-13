import { LinuxCanvasArchiveInstaller } from '../linux/LinuxCanvasArchiveInstaller.js';
import { WindowsCanvasArchiveInstaller } from '../windows/WindowsCanvasArchiveInstaller.js';

export function createCanvasArchiveInstaller(platform, dependencies) {
  if (platform === 'win32') return new WindowsCanvasArchiveInstaller(dependencies);
  return new LinuxCanvasArchiveInstaller(dependencies);
}
