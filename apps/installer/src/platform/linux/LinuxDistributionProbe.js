import fs from 'node:fs';

function parseOsRelease(content) {
  return Object.fromEntries(content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1).replace(/^['"]|['"]$/g, '');
      return [key, value];
    }));
}

export class LinuxDistributionProbe {
  constructor({ readFile = () => fs.readFileSync('/etc/os-release', 'utf8') } = {}) {
    this.readFile = readFile;
  }

  inspect() {
    try {
      const values = parseOsRelease(this.readFile());
      const id = values.ID?.toLowerCase() || '';
      return {
        id,
        idLike: (values.ID_LIKE || '').toLowerCase().split(/\s+/).filter(Boolean),
        codename: values.UBUNTU_CODENAME || values.VERSION_CODENAME || '',
        repository: ['ubuntu', 'debian'].includes(id) ? id : null
      };
    } catch {
      return { id: '', idLike: [], codename: '', repository: null };
    }
  }
}
