import { WindowsGitCommandLocator } from '../windows/WindowsGitCommandLocator.js';

const noGitFallback = { find: () => null };

export function createGitCommandLocator(platform, dependencies) {
  if (platform === 'win32') return new WindowsGitCommandLocator(dependencies);
  return noGitFallback;
}
