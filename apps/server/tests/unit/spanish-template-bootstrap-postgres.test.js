import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const state = vi.hoisted(() => ({ isolatedPool: null }));

// The actual repository talks only to an ephemeral PostgreSQL testcontainer.
// It never connects to the application's configured local or production database.
vi.mock('../../src/data/db.js', () => ({
  default: {
    get pool() { return state.isolatedPool; },
    query(sql, values) { return state.isolatedPool.query(sql, values); }
  }
}));

import TemplateRepository from '../../src/data/TemplateRepository.js';
import TemplateManager from '../../src/services/TemplateManager.js';

const describePostgres = process.env.RUN_DOCKER_TESTS === 'true' ? describe : describe.skip;

describePostgres('Spanish default template bootstrap against isolated PostgreSQL', () => {
  let container;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('template_regression')
      .withUsername('test_user')
      .withPassword('test_pass')
      .start();
    state.isolatedPool = new pg.Pool({
      connectionString: container.getConnectionUri(),
      connectionTimeoutMillis: 5000,
      max: 2
    });
    await state.isolatedPool.query(`
      CREATE TABLE plantilla_feedback (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        nombre text NOT NULL,
        contenido text NOT NULL,
        profesor_id varchar(50),
        deleted_at timestamptz,
        CONSTRAINT uq_plantilla_nombre_profesor UNIQUE(nombre, profesor_id)
      );
      CREATE TABLE profesor_metadata (
        profesor_id varchar(50) PRIMARY KEY,
        has_seeded_templates boolean DEFAULT false,
        actualizado_en timestamptz DEFAULT now()
      );
    `);
  }, 120000);

  afterAll(async () => {
    if (state.isolatedPool) await state.isolatedPool.end();
    if (container) await container.stop();
    state.isolatedPool = null;
  });

  it('creates exactly three Spanish default templates for a new teacher on first login', async () => {
    const manager = new TemplateManager(new TemplateRepository());
    const templates = await manager.getTemplatesForProfesor('regression-teacher-1');
    expect(templates).toHaveLength(3);
    expect(templates.map(template => template.nombre).sort()).toEqual(
      ['Clase Estándar', 'Evaluación Cruzada', 'Feedback Detallado'].sort()
    );
    expect(templates.every(template => template.profesor_id === 'regression-teacher-1')).toBe(true);
    for (const template of templates) {
      const ranges = JSON.parse(template.contenido);
      expect(Object.keys(ranges).sort()).toEqual(['alto', 'bajo', 'medio']);
    }
  });

  it('does not duplicate defaults on subsequent access by the same teacher', async () => {
    const manager = new TemplateManager(new TemplateRepository());
    await manager.getTemplatesForProfesor('regression-teacher-2');
    const templates = await manager.getTemplatesForProfesor('regression-teacher-2');
    expect(templates).toHaveLength(3);
    const result = await state.isolatedPool.query(
      'SELECT COUNT(*)::int AS count FROM plantilla_feedback WHERE profesor_id = $1',
      ['regression-teacher-2']
    );
    expect(result.rows[0].count).toBe(3);
  });
});
