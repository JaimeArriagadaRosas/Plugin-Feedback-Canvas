import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOTENBERG_URL = 'http://localhost:3001/forms/libreoffice/convert';
const TEST_FILE_NAME = 'massive_test_file.txt';
const TEST_FILE_PATH = path.join(__dirname, TEST_FILE_NAME);

// 1. Generate a massive test file
async function createMassiveFile(lines) {
  console.log(`Generating test file with ${lines} lines...`);
  const stream = fs.createWriteStream(TEST_FILE_PATH);
  for (let i = 0; i < lines; i++) {
    stream.write(`Test line ${i} to stress Gotenberg. LibreOffice will have to paginate all this.\n`);
    // We add some nonsense text to make it heavier
    stream.write(`Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.\n`);
  }
  return new Promise((resolve) => {
    stream.end(() => {
      const stats = fs.statSync(TEST_FILE_PATH);
      console.log(`File generated: ${stats.size / 1024 / 1024} MB`);
      resolve();
    });
  });
}

// 2. Send to Gotenberg
async function sendToGotenberg() {
  console.log(`Sending file to ${GOTENBERG_URL}...`);
  const fileBuffer = fs.readFileSync(TEST_FILE_PATH);
  const blob = new Blob([fileBuffer], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('files', blob, TEST_FILE_NAME);

  console.time('Gotenberg_Response_Time');
  try {
    const response = await fetch(GOTENBERG_URL, {
      method: 'POST',
      body: formData,
    });
    console.timeEnd('Gotenberg_Response_Time');

    if (response.ok) {
      console.log('✅ Success: Conversion completed. Status 200.');
    } else {
      const errText = await response.text();
      console.error(`❌ Conversion failed: Status ${response.status} - ${errText}`);
    }
  } catch (err) {
    console.timeEnd('Gotenberg_Response_Time');
    console.error(`❌ Network / Timeout error: ${err.message}`);
  }
}

// Main
async function run() {
  console.log('--- STARTING GOTENBERG STRESS TEST ---');
  // Adjust this number to make it heavier or lighter (100,000 lines ~ 20MB of text)
  await createMassiveFile(100000); 
  await sendToGotenberg();
  
  // Cleanup
  fs.unlinkSync(TEST_FILE_PATH);
  console.log('--- TEST FINISHED ---');
}

run();
