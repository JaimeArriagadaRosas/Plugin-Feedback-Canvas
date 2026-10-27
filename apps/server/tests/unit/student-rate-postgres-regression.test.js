import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import pg from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
const state = vi.hoisted(() => ({ pool: null }));
vi.mock('../../src/data/db.js', () => ({
  default: { query(sql, args) { return state.pool.query(sql, args); } }
}));
import FeedbackRepository from '../../src/data/FeedbackRepository.js';
import FeedbackMutationService from '../../src/services/FeedbackMutationService.js';

const suite = process.env.RUN_DOCKER_TESTS === 'true' ? describe : describe.skip;
suite('student rate persistence on isolated PostgreSQL 15', () => {
  let container, pool, service;
  const row = async (id = 1) => (await pool.query('SELECT * FROM historial_feedback_generado WHERE id=$1', [id])).rows[0];
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine').start();
    pool = new pg.Pool({ connectionString: container.getConnectionUri() });
    state.pool = pool;
    await pool.query(`CREATE TABLE historial_feedback_generado (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      estudiante_id VARCHAR(50) NOT NULL,
      estado TEXT NOT NULL,
      calificacion_estudiante INTEGER,
      es_util BOOLEAN,
      fecha_generacion TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO historial_feedback_generado(estudiante_id,estado)
      VALUES ('7','ENVIADO'), ('8','ENVIADO'), ('7','PENDIENTE');`);
    service = new FeedbackMutationService(new FeedbackRepository());
  }, 120000);
  beforeEach(async () => { await pool.query('UPDATE historial_feedback_generado SET calificacion_estudiante=NULL,es_util=NULL'); });
  afterAll(async () => { if (pool) await pool.end(); if (container) await container.stop(); state.pool=null; });
  it('saves stars one through five and preserves usefulness', async () => {
    for (const stars of [1,2,3,4,5]) {
      await service.rateByStudent(1,stars,undefined,{ studentId:'7' });
      expect((await row()).calificacion_estudiante).toBe(stars);
    }
  });
  it('accepts usefulness alone, including false', async () => {
    await service.rateByStudent(1,undefined,false,{ studentId:'7' });
    expect((await row()).es_util).toBe(false);
    expect((await row()).calificacion_estudiante).toBeNull();
    await service.rateByStudent(1,undefined,true,{ studentId:'7' });
    expect((await row()).es_util).toBe(true);
  });
  it('preserves the unchanged dimension after separate requests', async () => {
    await service.rateByStudent(1,4,true,{ studentId:'7' });
    await service.rateByStudent(1,undefined,false,{ studentId:'7' });
    expect((await row()).calificacion_estudiante).toBe(4);
    await service.rateByStudent(1,2,undefined,{ studentId:'7' });
    expect((await row()).es_util).toBe(false);
  });
  it('denies feedback owned by someone else', async () => {
    await expect(service.rateByStudent(2,4,true,{ studentId:'7' })).rejects.toThrow();
    expect((await row(2)).calificacion_estudiante).toBeNull();
  });
  it('rejects missing or unpublished feedback', async () => {
    await expect(service.rateByStudent(999,3,true,{ studentId:'7' })).rejects.toThrow();
    await expect(service.rateByStudent(3,3,true,{ studentId:'7' })).rejects.toThrow();
    expect((await row(3)).calificacion_estudiante).toBeNull();
  });
  it('is idempotent when the same usefulness is submitted repeatedly', async () => {
    await service.rateByStudent(1,5,false,{ studentId:'7' });
    await service.rateByStudent(1,5,false,{ studentId:'7' });
    expect((await row()).calificacion_estudiante).toBe(5);
    expect((await row()).es_util).toBe(false);
  });
  it('does not modify another student while rating own feedback', async () => {
    await service.rateByStudent(1,3,true,{ studentId:'7' });
    expect((await row(2)).calificacion_estudiante).toBeNull();
    await service.rateByStudent(2,2,false,{ studentId:'8' });
    expect((await row()).calificacion_estudiante).toBe(3);
    expect((await row(2)).es_util).toBe(false);
  });
  it('does not rewrite feedback generation timestamp when rating changes', async () => {
    const before = (await row()).fecha_generacion.getTime();
    await service.rateByStudent(1,4,true,{ studentId:'7' });
    expect((await row()).fecha_generacion.getTime()).toBe(before);
  });
  it('fails cleanly on a database error and can retry', async () => {
    const original = pool.query.bind(pool);
    const spy = vi.spyOn(pool,'query').mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.rateByStudent(1,4,true,{ studentId:'7' })).rejects.toThrow('database unavailable');
    spy.mockRestore();
    await service.rateByStudent(1,4,true,{ studentId:'7' });
    const saved = (await original('SELECT calificacion_estudiante FROM historial_feedback_generado WHERE id=1')).rows[0];
    expect(saved.calificacion_estudiante).toBe(4);
  });

});
