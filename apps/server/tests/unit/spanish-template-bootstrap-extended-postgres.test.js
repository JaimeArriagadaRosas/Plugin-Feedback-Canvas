import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const state = vi.hoisted(() => ({ pool: null }));
vi.mock('../../src/data/db.js', () => ({
  default: {
    get pool() { return state.pool; },
    query(sql, values) { return state.pool.query(sql, values); }
  }
}));
import TemplateRepository from '../../src/data/TemplateRepository.js';
import TemplateManager from '../../src/services/TemplateManager.js';

const suite = process.env.RUN_DOCKER_TESTS === 'true' ? describe : describe.skip;
const names = ['Clase Est\u00e1ndar', 'Feedback Detallado', 'Evaluaci\u00f3n Cruzada'];
const manager = new TemplateManager(new TemplateRepository());
async function rows(id) {
  const { rows } = await state.pool.query(
    'SELECT nombre,contenido,deleted_at FROM plantilla_feedback WHERE profesor_id=$1 ORDER BY nombre', [id]);
  return rows;
}
suite('Spanish template bootstrap edge cases (isolated PostgreSQL 15)', () => {
  let container;
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('bootstrap_edge_test').withUsername('test_user').withPassword('test_pass').start();
    state.pool = new pg.Pool({ connectionString: container.getConnectionUri(), max: 8 });
    await state.pool.query(`
      CREATE TABLE plantilla_feedback (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        nombre text NOT NULL, contenido text NOT NULL, profesor_id varchar(50),
        deleted_at timestamptz, actualizado_en timestamptz DEFAULT now(),
        CONSTRAINT uq_plantilla_nombre_profesor UNIQUE(nombre,profesor_id));
      CREATE TABLE profesor_metadata (
        profesor_id varchar(50) PRIMARY KEY, has_seeded_templates boolean DEFAULT false,
        actualizado_en timestamptz DEFAULT now());`);
  }, 120000);
  beforeEach(async () => {
    await state.pool.query('TRUNCATE plantilla_feedback,profesor_metadata RESTART IDENTITY');
  });
  afterAll(async () => {
    if (state.pool) await state.pool.end();
    if (container) await container.stop();
    state.pool = null;
  });
  it('first access creates all three templates per professor, independently', async () => {
    for (const id of ['teacher-a', 'teacher-b', 'teacher-0003']) {
      const result = await manager.getTemplatesForProfesor(id);
      expect(result.map(r => r.nombre).sort()).toEqual([...names].sort());
      expect((await rows(id)).length).toBe(3);
      expect(result.every(r => r.profesor_id === id)).toBe(true);
    }
  });
  it('repeat logins keep the same IDs and exactly three rows', async () => {
    const first = await manager.getTemplatesForProfesor('teacher-repeat');
    for (let n = 0; n < 3; n++) await manager.getTemplatesForProfesor('teacher-repeat');
    const last = await manager.getTemplatesForProfesor('teacher-repeat');
    expect(last.map(r => r.id)).toEqual(first.map(r => r.id));
    expect(await rows('teacher-repeat')).toHaveLength(3);
  });
  it('parallel first logins for the same professor do not duplicate rows', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => manager.getTemplatesForProfesor('teacher-parallel')));
    expect(results.every(result => result.length === 3)).toBe(true);
    expect(await rows('teacher-parallel')).toHaveLength(3);
  });
  it('pre-existing custom template is preserved when defaults are bootstrapped', async () => {
    await state.pool.query(
      'INSERT INTO plantilla_feedback(nombre,contenido,profesor_id) VALUES ($1,$2,$3)',
      ['My Own Template','custom-content','teacher-custom']);
    const result = await manager.getTemplatesForProfesor('teacher-custom');
    expect(result).toHaveLength(4);
    expect((await rows('teacher-custom')).find(r => r.nombre === 'My Own Template').contenido)
      .toBe('custom-content');
  });
  it('missing default is restored when professor already has one locale default', async () => {
    await state.pool.query(
      'INSERT INTO plantilla_feedback(nombre,contenido,profesor_id) VALUES ($1,$2,$3)',
      ['Clase Est\u00e1ndar','personalized','teacher-partial']);
    const result = await manager.getTemplatesForProfesor('teacher-partial');
    expect(result.map(r => r.nombre).sort()).toEqual([...names].sort());
    expect((await rows('teacher-partial')).find(r => r.nombre === 'Clase Est\u00e1ndar').contenido)
      .toBe('personalized');
  });
  it('soft-deleted default is not resurrected after another login', async () => {
    await manager.getTemplatesForProfesor('teacher-deleted');
    const row = (await state.pool.query(
      'SELECT id FROM plantilla_feedback WHERE profesor_id=$1 AND nombre=$2',
      ['teacher-deleted','Clase Est\u00e1ndar'])).rows[0];
    await manager.deleteTemplate(row.id, 'teacher-deleted');
    const result = await manager.getTemplatesForProfesor('teacher-deleted');
    expect(result).toHaveLength(2);
    expect(await rows('teacher-deleted')).toHaveLength(3);
  });
  it('metadata seeded flag alone cannot prevent bootstrap', async () => {
    await state.pool.query(
      'INSERT INTO profesor_metadata(profesor_id,has_seeded_templates) VALUES($1,true)',
      ['teacher-old-metadata']);
    expect(await manager.getTemplatesForProfesor('teacher-old-metadata')).toHaveLength(3);
  });
  it('all saved templates have valid three-range JSON and never leak into other teachers', async () => {
    await Promise.all(['a1','b2','c3'].map(id => manager.getTemplatesForProfesor(id)));
    for (const id of ['a1','b2','c3']) {
      const own = await rows(id);
      expect(own).toHaveLength(3);
      for (const record of own) {
        expect(Object.keys(JSON.parse(record.contenido)).sort()).toEqual(['alto','bajo','medio']);
      }
    }
  });
});
