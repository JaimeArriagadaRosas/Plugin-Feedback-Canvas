import { readFileSync } from 'fs';

function main() {
  console.log('=== Verificando FUENTE de Templates ===');
  const src = readFileSync('./src/servicios/CanvasService.mock.js', 'utf8');

  // Find getSubmission lines
  const lines = src.split('\n');
  
  // Find line 245: "const questions = await this.getQuizQuestions(...)"
  // and the entire getSubmission method
  const inGetSubmission = false;
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
