import { z } from 'zod';

export const FeedbackResponseSchema = z.object({
  exito: z.boolean(),
  data: z.object({
    id: z.number().optional(),
    content: z.string().optional(),
    promptUsed: z.string().optional(),
    canvasScore: z.number(),
    chileGrade: z.number(),
    approved: z.boolean(),
    questionsDetail: z.string().optional(),
    studentName: z.string().optional(),
    assignmentName: z.string().optional(),
    profile: z.object({
      level: z.string(),
      trend: z.string(),
      average: z.number()
    }).optional()
  }).optional()
});

export const FeedbackListSchema = z.object({
  exito: z.boolean(),
  data: z.array(z.object({
    id: z.number(),
    student: z.string(),
    studentId: z.union([z.string(), z.number()]),
    courseId: z.union([z.string(), z.number()]),
    assignmentId: z.union([z.string(), z.number()]),
    grade: z.string(),
    profile: z.string(),
    trend: z.string(),
    status: z.string(),
    feedback: z.string().optional()
  }))
});

export const FeedbackDetailSchema = z.object({
  exito: z.boolean(),
  data: z.array(z.object({
    id: z.number(),
    estudiante_id: z.union([z.string(), z.number()]),
    curso_id: z.union([z.string(), z.number()]),
    tarea_id: z.union([z.string(), z.number()]),
    plantilla_id: z.number().optional(),
    contenido_generado: z.string(),
    estado: z.string(),
    nota_canvas: z.number().optional(),
    nota_chile: z.number().optional()
  }))
});

export function expectValidFeedbackResponse(res, schema = FeedbackResponseSchema) {
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(500);
  const body = res.body;
  expect(schema.safeParse(body).success).toBe(true);
  if (!schema.safeParse(body).success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(schema.safeParse(body).error.issues)}`);
  }
  return body;
}
