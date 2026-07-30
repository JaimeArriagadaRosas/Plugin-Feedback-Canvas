import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function replaceConsoleWithLogger(filePath, importStatement) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace console.info/warn/error/debug with logger.
  content = content.replace(/console\.(info|warn|error|debug)/g, 'logger.$1');
  
  if (!content.includes(importStatement)) {
    // Inject import after other imports
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, importStatement);
      content = lines.join('\n');
    } else {
      content = importStatement + '\n' + content;
    }
  }
  
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${filePath}`);
}

const bootstrapPath = path.join(__dirname, '..', 'src', 'services', 'server', 'bootstrap.js');
replaceConsoleWithLogger(bootstrapPath, "import logger from '../../utils/logger.js';");

const serverPath = path.join(__dirname, '..', 'src', 'server.js');
replaceConsoleWithLogger(serverPath, "import logger from './utils/logger.js';");
