export class WindowsDockerPolicy {
  constructor(host) {
    this.host = host;
    this.id = 'windows';
    this.waitTimeoutSeconds = 180;
  }

  missing() {
    return {
      message: 'Docker Desktop is not installed or its CLI is not in PATH.',
      action: 'Install Docker Desktop for Windows and enable the WSL2 backend.',
      fix: 'Windows: https://docs.docker.com/desktop/setup/install/windows-install/'
    };
  }

  daemon() {
    return {
      message: 'Docker Desktop is installed, but its daemon is not available.',
      action: 'Open Docker Desktop and wait until it indicates the Engine is active.',
      fix: 'Start Docker Desktop and check the WSL2 backend.'
    };
  }

  permission() {
    return this.daemon();
  }

  memory() {
    return {
      action: 'Adjust the WSL2 backend memory in `%UserProfile%\\.wslconfig` and restart Docker Desktop.'
    };
  }

  compose() {
    return 'Update or repair Docker Desktop; Compose V2 should be included.';
  }

  install() {
    return {
      target: 'C:\\Program Files\\Docker\\Docker',
      prompt: 'Do you want to download and install Docker Desktop for Windows?',
      declined: 'Install Docker Desktop from https://docs.docker.com/desktop/setup/install/windows-install/ and run npm start again.'
    };
  }
}
