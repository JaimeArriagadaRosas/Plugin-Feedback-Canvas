import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { runCommand } from '../orchestration/boot/setup/utils/Runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANVAS_DIR = path.resolve(__dirname, '../../../../../canvas-lms-master');
const PROFILES_PATH = path.resolve(CANVAS_DIR, 'tmp/perfiles_data.json');

export class TeacherTokenGenerator {
  static async generate() {
    try {
      console.log(`${pc.cyan('[LTI Installer]')} Generando/verificando token de API del profesor para Canvas Local...`);
      const teacherEmail = process.env.CANVAS_TEACHER_EMAIL || 'profesor@canvas.local';
      const script = `
        user = User.find_by(email: '${teacherEmail}') || User.find_by(name: 'Dr. Elena Ramirez')
        if user
          user.access_tokens.where(purpose: 'Local Dev Token').destroy_all
          token = user.access_tokens.create!(purpose: 'Local Dev Token')
          data = {
            user_id: user.id,
            email: user.email || '${teacherEmail}',
            token: token.full_token
          }
          puts "TEACHER_TOKEN_JSON_START"
          puts data.to_json
          puts "TEACHER_TOKEN_JSON_END"
        else
          puts "TEACHER_TOKEN_JSON_START"
          puts "{}"
          puts "TEACHER_TOKEN_JSON_END"
        end
      `;
      const { success, out, err } = await runCommand('docker', ['compose', 'exec', '-T', '-e', 'DISABLE_SPRING=1', 'web', 'bundle', 'exec', 'rails', 'runner', script], { cwd: CANVAS_DIR, env: process.env });
      
      if (!success) throw new Error(`Rails exit error. Stderr: ${err}`);
      
      const match = out.match(/TEACHER_TOKEN_JSON_START\s*([\s\S]*?)\s*TEACHER_TOKEN_JSON_END/);
      if (!match) throw new Error(`No JSON output. Salida: ${out}`);
      
      const data = JSON.parse(match[1].trim());
      if (!data.token) throw new Error('Token vacío o profesor no encontrado');
      
      await this.persistTeacherToken(data);
      console.log(`${pc.green('[LTI Installer]')} Token del profesor listo (canvas_user_id=${data.user_id}). Guardado en perfiles_data.json.`);
    } catch (e) {
      console.log(`${pc.yellow('[LTI Installer]')} Advertencia: No se pudo generar el token del profesor. Error: ${e.message}`);
    }
  }

  static async persistTeacherToken({ user_id, email, token }) {
    let profiles = { usuarios: [] };
    try {
      const raw = await fs.readFile(PROFILES_PATH, 'utf-8');
      profiles = JSON.parse(raw);
    } catch {}

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
}
