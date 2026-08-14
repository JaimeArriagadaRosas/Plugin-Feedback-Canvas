import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getLtiJsonPath } from '../../src/local/LtiInstaller.js';
import { getPluginDirectory } from '../../src/installation/utils/LocalWorkspacePaths.js';

describe('getLtiJsonPath', () => {
  it('locates the LTI configuration inside the plugin repository', () => {
    expect(getLtiJsonPath()).toBe(path.join(getPluginDirectory(), 'config', 'lti_placement.json'));
  });
});
