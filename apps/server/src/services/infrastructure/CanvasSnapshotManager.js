import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import DockerRunner, { CANVAS_PATH } from './DockerRunner.js';


const __filename = fileURLToPath(import.meta.url);


const STATE_FILE = path.join(CANVAS_PATH, '.canvas_local_state.json');
const SNAPSHOTS_DIR = path.join(os.tmpdir(), 'canvas_snapshots');

export default class CanvasSnapshotManager {
  /**
   * Reads Canvas state file
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
   * Checks if a heavy step (e.g. assets_compiled) has already occurred.
   */
  static hasState(key) {
    const state = this._getState();
    // eslint-disable-next-line security/detect-object-injection
    return !!state[key];
  }

  /**
   * Returns the stored value for a state key, or null if it does not exist.
   */
  static getState(key) {
    const state = this._getState();
    // eslint-disable-next-line security/detect-object-injection
    return state[key] ?? null;
  }

  /**
   * Marks a step as completed in the local state.
   */
  static markState(keyvalue = true) {
    const state = this._getState();
    // eslint-disable-next-line security/detect-object-injection
    state[key] = value;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }

  /**
   * Deletes the state file to force clean installation
   */
  static clearState() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(STATE_FILE)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(STATE_FILE);
    }
  }

  /**
   * Creates a dump of the Canvas database (Snapshot) ultra fast
   * using pg_dump directly in the postgres container.
   */
  static async takeSnapshot(snapshotName) {
    console.log(`[CanvasSnapshotManager] 📸 Creating DB save point: ${snapshotName}...`);
    
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    }

    try {
      // Use docker compose exec for postgres. Redirect pg_dump output to the host.
      // -U canvas is the user. canvas_development is the DB in docker-compose
      // Note: The postgres container is called "postgres"
      await DockerRunner.runDockerCommand(
        ['compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'canvas', '-d', 'canvas_development', '-f', `/tmp/${snapshotName}.sql`],
        `PgDump-${snapshotName}`
      );
      
      // Copy the file from the container to the host
      await DockerRunner.runDockerCommand(
        ['compose', 'cp', `postgres:/tmp/${snapshotName}.sql`, path.join(SNAPSHOTS_DIR, `${snapshotName}.sql`)],
        `CopyDump-${snapshotName}`
      );
      
      console.log(`[CanvasSnapshotManager] ✅ Snapshot '${snapshotName}' saved successfully.`);
      return true;
    } catch (err) {
      console.error(`[CanvasSnapshotManager] ❌ Failed to create Snapshot '${snapshotName}':`, err.message);
      return false;
    }
  }

  /**
   * Checks if a specific snapshot exists on disk
   */
  static snapshotExists(snapshotName) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.existsSync(path.join(SNAPSHOTS_DIR, `${snapshotName}.sql`));
  }

  /**
   * Restores the DB from a Snapshot deleting all current data.
   */
  static async restoreSnapshot(snapshotName) {
    if (!this.snapshotExists(snapshotName)) {
      console.log(`[CanvasSnapshotManager] ⚠️ Snapshot '${snapshotName}' does not exist. Unable to restore.`);
      return false;
    }

    console.log(`[CanvasSnapshotManager] 🔄 Restoring saved game (DB): ${snapshotName}...`);
    try {
      // 1. Copy snapshot back to postgres container
      await DockerRunner.runDockerCommand(
        ['compose', 'cp', path.join(SNAPSHOTS_DIR, `${snapshotName}.sql`), `postgres:/tmp/${snapshotName}.sql`],
        `CopyRestore-${snapshotName}`
      );

      // 2. Terminate active connections and recreate public schema (Fast drop instead of dropdb)
      await DockerRunner.runDockerCommand(
        ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'canvas', '-d', 'canvas_development', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'],
        `DropSchema-${snapshotName}`
      );

      // 3. Restore from file
      await DockerRunner.runDockerCommand(
        ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'canvas', '-d', 'canvas_development', '-f', `/tmp/${snapshotName}.sql`],
        `PgRestore-${snapshotName}`
      );

      console.log(`[CanvasSnapshotManager] ✅ Game '${snapshotName}' restored in seconds.`);
      return true;
    } catch (err) {
      console.error(`[CanvasSnapshotManager] ❌ Failed to restore Snapshot '${snapshotName}':`, err.message);
      return false;
    }
  }
}

