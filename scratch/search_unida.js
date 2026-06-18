import fs from 'fs';
import path from 'path';

function search(dir, pattern) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      search(fullPath, pattern);
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.json') || file.endsWith('.html') || file.endsWith('.css')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes(pattern.toLowerCase())) {
        console.log(`Found pattern in: ${fullPath}`);
      }
    }
  }
}

search('D:/Descargas/Proyecto Plugin feedback/Plugin Feedback/src', 'UNIDA');
