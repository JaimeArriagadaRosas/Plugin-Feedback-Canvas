import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOTENBERG_URL = 'http://localhost:3001/forms/libreoffice/convert';
const TEST_FILE_NAME = 'massive_test_file.txt';
const TEST_FILE_PATH = path.join(__dirname, TEST_FILE_NAME);

// 1. Generar un archivo gigante de prueba
async function createMassiveFile(lines) {
  console.log(`Generando archivo de prueba con ${lines} líneas...`);
  const stream = fs.createWriteStream(TEST_FILE_PATH);
  for (let i = 0; i < lines; i++) {
    stream.write(`Línea de prueba ${i} para estresar Gotenberg. LibreOffice tendrá que paginar todo esto.\n`);
    // Agregamos algo de texto sin sentido para hacerlo más pesado
    stream.write(`Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.\n`);
  }
  return new Promise((resolve) => {
    stream.end(() => {
      const stats = fs.statSync(TEST_FILE_PATH);
      console.log(`Archivo generado: ${stats.size / 1024 / 1024} MB`);
      resolve();
    });
  });
}

// 2. Enviar a Gotenberg
async function sendToGotenberg() {
  console.log(`Enviando archivo a ${GOTENBERG_URL}...`);
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
      console.log('✅ Éxito: Conversión completada. Status 200.');
    } else {
      const errText = await response.text();
      console.error(`❌ Falló la conversión: Status ${response.status} - ${errText}`);
    }
  } catch (err) {
    console.timeEnd('Gotenberg_Response_Time');
    console.error(`❌ Error de red / Timeout: ${err.message}`);
  }
}

// Main
async function run() {
  console.log('--- INICIANDO PRUEBA DE ESTRÉS GOTENBERG ---');
  // Ajusta este número para hacerlo más o menos pesado (100,000 líneas ~ 20MB de texto)
  await createMassiveFile(100000); 
  await sendToGotenberg();
  
  // Limpieza
  fs.unlinkSync(TEST_FILE_PATH);
  console.log('--- PRUEBA FINALIZADA ---');
}

run();
