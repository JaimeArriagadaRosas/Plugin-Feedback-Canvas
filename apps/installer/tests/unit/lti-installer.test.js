import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getLtiJsonPath } from '../../src/local/LtiInstaller.js';
import { getPluginDirectory } from '../../src/installation/utils/LocalWorkspacePaths.js';

describe('getLtiJsonPath', () => {
  it('ubica la configuración LTI dentro del repositorio del plugin', () => {
    expect(getLtiJsonPath()).toBe(path.join(getPluginDirectory(), 'config', 'lti_placement.json'));
  });
});
