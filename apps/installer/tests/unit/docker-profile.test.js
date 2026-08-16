import { describe, expect, it } from 'vitest';
import { classifyDockerCliOrigin } from '../../src/platform/shared/DockerRuntimeProbe.js';

describe('DockerRuntimeProbe', () => {
  describe('classifyDockerCliOrigin', () => {
    it('returns remote if DOCKER_HOST is set', () => {
      expect(classifyDockerCliOrigin({ dockerHost: 'tcp://192.168.1.10:2375' })).toBe('remote');
    });

    it('returns remote if contextEndpoint starts with ssh://', () => {
      expect(classifyDockerCliOrigin({ contextEndpoint: 'ssh://user@server' })).toBe('remote');
    });

    it('returns remote if contextEndpoint starts with tcp://', () => {
      expect(classifyDockerCliOrigin({ contextEndpoint: 'tcp://server:2375' })).toBe('remote');
    });

    it('returns native for local unix socket', () => {
      expect(classifyDockerCliOrigin({ host: { isWindows: false, isMac: false, isWsl: false }, contextEndpoint: 'unix:///var/run/docker.sock' })).toBe('native');
    });

    it('returns windows-interop for WSL with mounted cli', () => {
      expect(classifyDockerCliOrigin({ host: { isWsl: true }, cliPath: '/mnt/c/Program Files/Docker/Docker/resources/bin/docker' })).toBe('windows-interop');
    });
  });
});
