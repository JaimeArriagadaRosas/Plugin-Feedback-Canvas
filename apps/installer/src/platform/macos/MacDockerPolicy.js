export class MacDockerPolicy {
  constructor(host) {
    this.host = host;
    this.id = 'mac';
    this.waitTimeoutSeconds = 180;
  }

  missing() {
    return {
      message: 'No compatible Docker runtime found on macOS.',
      action: 'Install Docker Desktop or OrbStack explicitly.',
      fix: 'macOS: https://docs.docker.com/desktop/setup/install/mac-install/'
    };
  }

  daemon() {
    return {
      message: 'The macOS container runtime is not active.',
      action: 'Open Docker Desktop or OrbStack and complete their initial permissions.',
      fix: 'Start the selected container application.'
    };
  }

  permission() {
    return this.daemon();
  }

  memory() {
    return {
      action: 'Adjust memory from the macOS container runtime preferences.'
    };
  }

  compose() {
    return 'Update the selected runtime and verify that it exposes `docker compose`.';
  }

  install() {
    return {
      target: '/Applications',
      prompt: 'Do you want to install a compatible container runtime for macOS?',
      declined: 'Install Docker Desktop or OrbStack and run npm start again.'
    };
  }
}
