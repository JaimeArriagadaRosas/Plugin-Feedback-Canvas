import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnDocker, waitForDockerProcess } from '../utils/dockerRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANVAS_DIR = path.resolve(__dirname, '../../../../../canvas-lms-master');
const PROFILES_PATH = path.resolve(CANVAS_DIR, 'tmp/perfiles_data.json');

const RUBY_SCRIPT = path.resolve(__dirname, 'generate_teacher_token.rb');

/**
 * Genera un Access Token de API para el profesor del Canvas Local y lo
 * persiste en tmp/perfiles_data.json para que el backend (modo local)
 * pueda autenticarse contra la Canvas API real sin depender de un token
 * de producción.
 */
export async function ensureTeacherToken(teacherEmail = 'profesor@canvas.local') {
  const script = await fs.readFile(RUBY_SCRIPT, 'utf-8');

  const proc = spawnDocker(
    ['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', '-'],
    { cwd: CANVAS_DIR, env: { ...process.env, TEACHER_EMAIL: teacherEmail } }
  );

  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (data) => { stdout += data.toString(); });
  proc.stderr.on('data', (data) => { stderr += data.toString(); });

  proc.stdin.write(script);
  proc.stdin.end();

  const code = await waitForDockerProcess(proc);
  if (code !== 0) {
    throw new Error(`rails runner exit ${code}. Stderr: ${stderr}\nStdout: ${stdout}`);
  }

  const match = stdout.match(/TEACHER_TOKEN_JSON_START\s*([\s\S]*?)\s*TEACHER_TOKEN_JSON_END/);
  if (!match) {
    throw new Error(`No se pudo generar el token del profesor. Salida:\n${stdout}\n${stderr}`);
  }

  const data = JSON.parse(match[1].trim());
  if (!data.token) {
    throw new Error(`El token del profesor generado está vacío. Salida:\n${stdout}`);
  }

  await persistTeacherToken(data);
  return data;
}

async function persistTeacherToken({ user_id, email, token }) {
  let profiles = { usuarios: [] };
  try {
    const raw = await fs.readFile(PROFILES_PATH, 'utf-8');
    profiles = JSON.parse(raw);
  } catch {
    // archivo inexistente: se crea desde cero
  }

  if (!Array.isArray(profiles.usuarios)) profiles.usuarios = [];

  const user = profiles.usuarios.find(u => u.email === email);
  if (user) {
    user.token = token;
    user.canvas_user_id = user_id;
  } else {
    profiles.usuarios.push({ id: profiles.usuarios.length + 1, nombre: 'Profesor', email, rol: 'teacher', token, canvas_user_id: user_id });
  }

  await fs.writeFile(PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
}
