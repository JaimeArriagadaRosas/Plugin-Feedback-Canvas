import path from 'node:path';
import {inspectPorts,resolveStartupPorts} from '../../apps/installer/src/orchestration/portManager.js';
const ports=[3000,5173,8443];
console.log('OWNERS',JSON.stringify(await inspectPorts(ports)));
console.log('DECISION',JSON.stringify(await resolveStartupPorts(ports,{projectDir:path.resolve('.'),mode:'3'})));
