import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import DockerRunner, { CANVAS_PATH } from './DockerRunner.js';
import logger from '../../utils/logger.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(CANVAS_PATH, '.canvas_local_state.json');
const SNAPSHOTS_DIR = path.join(os.tmpdir(), 'canvas_snapshots');

export default class CanvasSnapshotManager {
  /**
   * Lee el archivo de estado de Canvas
   */
  static _getState() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(STATE_FILE)) return {};
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    } catch (e) {
      return {};
    }
  }

  /**
   * Verifica si un paso pesado (ej: assets_compiled) ya ocurrió.
   */
  static hasState(key) {
    const state = this._getState();
    // eslint-disable-next-line security/detect-object-injection
    return !!state[key];
  }

  /**
   * Devuelve el valor almacenado para una clave de estado, o null si no existe.
   */
  static getState(key) {
    const state = this._getState();
    // eslint-disable-next-line security/detect-object-injection
    return state[key] ?? null;
  }

  /**
   * Marca un paso como completado en el estado local.
   */
  static markState(keyvalue = true) {
    const state = this._getState();
    // eslint-disable-next-line security/detect-object-injection
    state[key] = value;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }

  /**
   * Elimina el archivo de estado para forzar instalación limpia
   */
  static clearState() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(STATE_FILE)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(STATE_FILE);
    }
  }

  /**
   * Crea un volcado de la base de datos de Canvas (Snapshot) de forma ultra rápida
   * usando pg_dump directamente en el contenedor postgres.
   */
  static async takeSnapshot(snapshotName) {
    console.log(`[CanvasSnapshotManager] 📸 Creando punto de guardado de BD: ${snapshotName}...`);
    
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    }

    try {
      // Usamos docker compose exec para postgres. Redirigimos la salida de pg_dump al host.
      // -U canvas es el usuario. canvas_development es la BD en docker-compose
      // Nota: El contenedor postgres se llama "postgres"
      await DockerRunner.runDockerCommand(
        ['compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'canvas', '-d', 'canvas_development', '-f', `/tmp/${snapshotName}.sql`],
        `PgDump-${snapshotName}`
      );
      
      // Copiar el archivo del contenedor al host
      await DockerRunner.runDockerCommand(
        ['compose', 'cp', `postgres:/tmp/${snapshotName}.sql`, path.join(SNAPSHOTS_DIR, `${snapshotName}.sql`)],
        `CopyDump-${snapshotName}`
      );
      
      console.log(`[CanvasSnapshotManager] ✅ Snapshot '${snapshotName}' guardado exitosamente.`);
      return true;
    } catch (err) {
      console.error(`[CanvasSnapshotManager] ❌ Falló la creación del Snapshot '${snapshotName}':`, err.message);
      return false;
    }
  }

  /**
   * Verifica si un snapshot específico existe en disco
   */
  static snapshotExists(snapshotName) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.existsSync(path.join(SNAPSHOTS_DIR, `${snapshotName}.sql`));
  }

  /**
   * Restaura la BD a partir de un Snapshotborrando todo lo actual.
   */
  static async restoreSnapshot(snapshotName) {
    if (!this.snapshotExists(snapshotName)) {
      console.log(`[CanvasSnapshotManager] ⚠️ No existe el snapshot '${snapshotName}'. Imposible restaurar.`);
      return false;
    }

    console.log(`[CanvasSnapshotManager] 🔄 Restaurando partida guardada (BD): ${snapshotName}...`);
    try {
      // 1. Copiar snapshot de vuelta al contenedor de postgres
      await DockerRunner.runDockerCommand(
        ['compose', 'cp', path.join(SNAPSHOTS_DIR, `${snapshotName}.sql`), `postgres:/tmp/${snapshotName}.sql`],
        `CopyRestore-${snapshotName}`
      );

      // 2. Terminar conexiones activas y recrear schema public (Drop rápido en lugar de dropdb)
      await DockerRunner.runDockerCommand(
        ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'canvas', '-d', 'canvas_development', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'],
        `DropSchema-${snapshotName}`
      );

      // 3. Restaurar desde el archivo
      await DockerRunner.runDockerCommand(
        ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'canvas', '-d', 'canvas_development', '-f', `/tmp/${snapshotName}.sql`],
        `PgRestore-${snapshotName}`
      );

      console.log(`[CanvasSnapshotManager] ✅ Partida '${snapshotName}' restaurada en segundos.`);
      return true;
    } catch (err) {
      console.error(`[CanvasSnapshotManager] ❌ Falló la restauración del Snapshot '${snapshotName}':`, err.message);
      return false;
    }
  }
}

