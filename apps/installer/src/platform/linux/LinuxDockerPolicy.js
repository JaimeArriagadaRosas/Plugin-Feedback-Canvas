export class LinuxDockerPolicy {
  constructor(host) {
    this.host = host;
    this.id = 'linux';
    this.waitTimeoutSeconds = 60;
  }

  missing() {
    return {
      message: 'Docker Engine is not installed on Linux.',
      action: 'Install Docker Engine and the Compose V2 plugin with your distribution\'s package manager.',
      fix: 'Check https://docs.docker.com/engine/install/ and avoid installing Docker Desktop unless explicitly chosen.'
    };
  }

  daemon() {
    return {
      message: 'Docker Engine daemon is not active.',
      action: 'Start it with `sudo systemctl start docker` and check `systemctl status docker`.',
      fix: 'Linux: sudo systemctl enable --now docker'
    };
  }

  permission() {
    return {
      message: 'Docker socket exists, but the user does not have permissions.',
      action: 'Add the user to the docker group and start a new session.',
      fix: 'Linux: sudo usermod -aG docker $USER; log out and log back in.'
    };
  }

  memory() {
    return {
      action: 'Docker Engine uses host memory. Expand the VM or reduce Canvas services; there are no Docker Desktop preferences in this mode.'
    };
  }

  compose() {
    return 'Install the Compose V2 package of your distribution (for example, `sudo apt-get install docker-compose-v2`).';
  }

  install() {
    return {
      target: 'Linux system packages',
      prompt: 'Do you want to install Docker Engine and Compose V2 via the Linux package manager?',
      declined: 'Install Docker Engine following https://docs.docker.com/engine/install/ and run npm start again.'
    };
  }
}
