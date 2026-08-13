import * as net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { assertPortsAvailable, isPortInUse } from '../../src/orchestration/portManager.js';

const servers = [];

function listenOnEphemeralPort() {
  return new Promise((resolve) => {
    const server = net.createServer().listen(0, () => {
      servers.push(server);
      resolve(server.address().port);
    });
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe('portManager', () => {
  it('detecta puertos libres sin terminar procesos', async () => {
    const port = await listenOnEphemeralPort();
    await new Promise((resolve) => servers[0].close(resolve));
    servers.length = 0;

    await expect(isPortInUse(port)).resolves.toBe(false);
    await expect(assertPortsAvailable(port)).resolves.toBe(true);
  });

  it('rechaza un puerto ocupado sin matar al proceso propietario', async () => {
    const port = await listenOnEphemeralPort();

    await expect(assertPortsAvailable(port)).rejects.toThrow(String(port));
    await expect(isPortInUse(port)).resolves.toBe(true);
  });
});
