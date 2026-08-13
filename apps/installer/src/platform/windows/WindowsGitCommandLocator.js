import path from 'node:path';

export class WindowsGitCommandLocator {
  constructor({ fs, fileSystem = fs, userProfile = process.env.USERPROFILE }) {
    this.fs = fileSystem;
    this.userProfile = userProfile;
  }

  find() {
    if (!this.userProfile) return null;
    const desktopDir = path.join(this.userProfile, 'AppData', 'Local', 'GitHubDesktop');
    if (!this.fs.existsSync(desktopDir)) return null;

    const applications = this.fs.readdirSync(desktopDir)
      .filter((entry) => entry.startsWith('app-'))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
    if (applications.length === 0) return null;

    const gitPath = path.join(
      desktopDir, applications[0], 'resources', 'app', 'git', 'cmd', 'git.exe'
    );
    return this.fs.existsSync(gitPath) ? gitPath : null;
  }
}
