import { describe, expect, it } from 'vitest';

import { toWindowsWslPath } from '../../src/platform/linux/WslCertificateToolInstaller.js';

describe('toWindowsWslPath', () => {
  it('convierte la CA de WSL a una ruta UNC que Windows puede abrir', () => {
    expect(toWindowsWslPath('/home/jaime/.local/share/mkcert/rootCA.pem', 'Ubuntu-26.04'))
      .toBe('\\\\wsl.localhost\\Ubuntu-26.04\\home\\jaime\\.local\\share\\mkcert\\rootCA.pem');
  });

  it('rechaza rutas o distribuciones incompletas', () => {
    expect(toWindowsWslPath('relative/rootCA.pem', 'Ubuntu')).toBeNull();
    expect(toWindowsWslPath('/home/jaime/rootCA.pem', '')).toBeNull();
  });
});
