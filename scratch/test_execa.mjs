import { execa } from 'execa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const useBuffer = process.argv[2] === 'true';
  console.log(`Running execa with buffer: ${useBuffer}`);
  
  const initialMemory = process.memoryUsage();
  let maxRss = initialMemory.rss;
  
  const interval = setInterval(() => {
    const currentRss = process.memoryUsage().rss;
    if (currentRss > maxRss) maxRss = currentRss;
    console.log(`Monitor: ${Math.round(currentRss / 1024 / 1024)} MB RSS`);
  }, 100);

  try {
    const child = execa('node', [path.join(__dirname, 'heavy_output.js')], {
      buffer: useBuffer
    });

    child.stdout.on('data', () => { /* consume stream so it flows */ });
    
    await child;
  } catch (e) {
    console.error('Process error or finished');
  }
  
  clearInterval(interval);
  console.log(`PICO máximo de memoria: ${Math.round(maxRss / 1024 / 1024)} MB RSS`);
}

main().catch(console.error);
