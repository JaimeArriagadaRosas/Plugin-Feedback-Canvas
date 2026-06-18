import { readFileSync } from 'fs';

function main() {
  console.log('=== Verificando FUENTE de Templates ===');
  const src = readFileSync('./src/servicios/CanvasService.local.js', 'utf8');

  // Find getSubmission lines
  const lines = src.split('\n');
  
  // Find the entire getSubmission method
  let recording = false;
  let i = 0;
  for (const line of lines) {
    if (line.includes('async getSubmission(')) recording = true;
    if (recording) console.log(`${i+1}: ${line}`);
    if (recording && line.trim() === '}') {
      console.log('--- end of getSubmission method ---');
      break;
    }
    i++;
  }
}

main();
