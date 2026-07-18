import { describe, it, expect, beforeEach } from 'vitest';
import { request, app } from '../setup/app.js';

describe('Courses routes  Caja Negra', () => {
  beforeEach(() => {
    process.env.LOCAL_USER_ROLE = 'teacher';
    process.env.USE_LOCAL_DATA = 'true';
    process.env.VITE_USE_LOCAL_DATA = 'true';
  });

  it('list cursos retorna 200', async () => {
    const res = await request(app).get('/api/courses');
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('list assignments retorna 200', async () => {
    const res = await request(app).get('/api/courses/14852/assignments');
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('list students retorna 200', async () => {
    const res = await request(app).get('/api/courses/14852/students');
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });

  it('rechaza courseId invalido', async () => {
    const res = await request(app).get('/api/courses/abc/assignments');
    expect(res.status).toBe(400);
  });

  it('rechaza assignmentId invalido', async () => {
    const res = await request(app).get('/api/courses/14852/assignments/abc/submissions/1');
    expect(res.status).toBe(400);
  });

  it('rechaza studentId invalido', async () => {
    const res = await request(app).get('/api/courses/14852/assignments/101/submissions/xyz');
    expect(res.status).toBe(400);
  });

  it('rechaza acceso student a cursos', async () => {
    process.env.LOCAL_USER_ROLE = 'student-1';

    const res = await request(app).get('/api/courses');
    expect(res.status).toBe(403);
  });

  it('toggle plugin retorna 200', async () => {
    const res = await request(app).post('/api/courses/14852/assignments/101/toggle');
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
  });
});
