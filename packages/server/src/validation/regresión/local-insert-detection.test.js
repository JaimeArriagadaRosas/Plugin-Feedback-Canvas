import { describe, it, expect, vi, beforeEach } from 'vitest';
import db from '../../data/db.js';

describe('Regresin  Error 5: Deteccin de INSERTs en modo local', () => {
  beforeEach(() => {
    process.env.VITE_USE_LOCAL_DATA = 'true';
  });

  it('detecta INSERT INTO Historial_Feedback_Generado (maysculas)', async () => {
    const res = await db.query(
      'INSERT INTO Historial_Feedback_Generado (estudiante_id, curso_id, tarea_id, plantilla_id, contenido_generado, prompt_usado, nota_canvas, nota_chile, aprobado, estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [1, 14852, 101, 1, 'contenido', 'prompt', 90, 6.9, true, 'generado']
    );

    expect(res).toBeDefined();
    expect(res.rows).toBeDefined();
    expect(res.rows[0]).toBeDefined();
    expect(res.rows[0].estado).toBe('PENDIENTE');
  });

  it('detecta INSERT con nombre de tabla en minsculas', async () => {
    const res = await db.query(
      'INSERT INTO historial_feedback_generado (estudiante_id, curso_id, tarea_id, plantilla_id, contenido_generado, prompt_usado, nota_canvas, nota_chile, aprobado, estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [2, 14852, 101, 1, 'contenido', 'prompt', 50, 3.4, false, 'generado']
    );

    expect(res).toBeDefined();
    expect(res.rows).toBeDefined();
  });

  it('detecta SELECT sobre Historial_Feedback_Generado', async () => {
    const res = await db.query('SELECT * FROM Historial_Feedback_Generado WHERE estudiante_id = $1', [1]);
    expect(res).toBeDefined();
    expect(Array.isArray(res.rows)).toBe(true);
  });
});
