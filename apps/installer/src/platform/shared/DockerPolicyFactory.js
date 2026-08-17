import { LinuxDockerPolicy } from '../linux/LinuxDockerPolicy.js';
import { MacDockerPolicy } from '../macos/MacDockerPolicy.js';
import { WindowsDockerPolicy } from '../windows/WindowsDockerPolicy.js';
import { WslDockerPolicy } from '../linux/WslDockerPolicy.js';

export function createDockerPolicy(host) {
  if (host.isWsl) return new WslDockerPolicy(host);
  if (host.isLinux) return new LinuxDockerPolicy(host);
  if (host.isWindows) return new WindowsDockerPolicy(host);
  if (host.isMac) return new MacDockerPolicy(host);
  throw new Error(`Unsupported operating system: ${host.name}`);
}
