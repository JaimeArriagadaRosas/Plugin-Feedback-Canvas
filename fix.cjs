const fs = require('fs');

let c = fs.readFileSync('apps/server/src/services/infrastructure/CanvasSnapshotManager.js', 'utf8');
c = c.replace(/fro'path'/g, "from 'path'");
c = c.replace(/fro'url'/g, "from 'url'");
c = c.replace(/fro'os'/g, "from 'os'");
c = c.replace(/fro'\.\/DockerRunner\.js'/g, "from './DockerRunner.js'");
c = c.replace(/fro'\.\.\/\.\.\/utils\/logger\.js'/g, "from '../../utils/logger.js'");
c = c.replace(/fs\.readFileSync\(STATE_FILE'utf-8'\)/g, "fs.readFileSync(STATE_FILE, 'utf-8')");
fs.writeFileSync('apps/server/src/services/infrastructure/CanvasSnapshotManager.js', c);

let d = fs.readFileSync('apps/server/src/services/infrastructure/DockerRunner.js', 'utf8');
d = d.replace(/spawnexecSync/g, 'spawn, execSync');
d = d.replace(/fro'child_process'/g, "from 'child_process'");
d = d.replace(/fro'path'/g, "from 'path'");
d = d.replace(/fro'url'/g, "from 'url'");
d = d.replace(/fro'fs'/g, "from 'fs'");
d = d.replace(/fs\.appendFileSync\(DOCKER_LOG_FILE`/g, "fs.appendFileSync(DOCKER_LOG_FILE, `");
d = d.replace(/process\.platfor===/g, "process.platform ===");
d = d.replace(/\['-', '\\\\', '\\|''\/'\]/g, "['-', '\\\\', '|', '/']");
d = d.replace(/\['⠋''⠙', '⠹''⠸', '⠼''⠴', '⠦''⠧', '⠇''⠏'\]/g, "['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']");
fs.writeFileSync('apps/server/src/services/infrastructure/DockerRunner.js', d);
