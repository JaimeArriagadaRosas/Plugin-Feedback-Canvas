import * as net from 'node:net';

export function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => server.close(() => resolve(false)));
    server.listen(port);
  });
}

export async function assertPortsAvailable(...ports) {
  const occupied = [];
  for (const port of ports) {
    if (await isPortInUse(port)) occupied.push(port);
  }
  if (occupied.length) {
    throw new Error(
      `Los puertos ${occupied.join(', ')} ya estan ocupados. ` +
      'Detenga el proceso propietario o configure otros puertos; el plugin no lo terminara automaticamente.'
    );
  }
  return true;
}

/** @deprecated Conservado para llamadas externas; nunca mata procesos ajenos. */
export async function clearPorts(...ports) {
  return assertPortsAvailable(...ports);
}
