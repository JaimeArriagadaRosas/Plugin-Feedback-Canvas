export class WslDockerPolicy {
  constructor(host) {
    this.host = host;
    this.id = 'wsl';
    this.waitTimeoutSeconds = 90;
  }

  missing() {
    return {
      message: `Docker is not available inside ${this.host.distro}.`,
      action: 'Choose a single mode: Docker Desktop WSL integration or native Docker Engine inside the distro.',
      fix: 'Docker Desktop: enable Resources > WSL Integration. Native Engine: follow https://docs.docker.com/engine/install/ubuntu/.'
    };
  }

  daemon(state) {
    if (state.cliOrigin === 'windows-interop') {
      return {
        message: 'WSL found the Windows Docker client, but Docker Desktop does not expose a usable daemon.',
        action: `Start Docker Desktop and enable integration for ${this.host.distro}; do not install a second Engine automatically.`,
        fix: 'Windows: Docker Desktop > Settings > Resources > WSL Integration.'
      };
    }
    return {
      message: 'Native Docker Engine is installed inside WSL, but its daemon is not active.',
      action: 'Start the Linux service with `sudo systemctl start docker`.',
      fix: 'WSL/Linux: sudo systemctl enable --now docker'
    };
  }

  permission(state) {
    if (state.cliOrigin === 'windows-interop') return this.daemon(state);
    return {
      message: 'The WSL user does not have permissions on the native Docker socket.',
      action: 'Add the user to the docker group and restart the WSL distro.',
      fix: 'sudo usermod -aG docker $USER; then run `wsl --shutdown` from Windows.'
    };
  }

  memory() {
    return {
      action: 'Adjust memory from Docker Desktop or from `%UserProfile%\\.wslconfig` in Windows and restart WSL.'
    };
  }

  compose(state) {
    return state.cliOrigin === 'windows-interop'
      ? 'Update Docker Desktop and verify that `docker compose version` works inside WSL.'
      : 'Install Compose V2 inside the distro along with Docker Engine.';
  }

  install() {
    return {
      target: `Native Docker Engine inside ${this.host.distro}`,
      prompt: `No Docker Desktop integration detected. Do you want to explicitly install Docker Engine inside ${this.host.distro}?`,
      declined: `Enable Docker Desktop > Resources > WSL Integration for ${this.host.distro} and run npm start again.`
    };
  }
}
