import { z } from 'zod';

export const TemplateSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  contenido: z.string(),
  creado_en: z.string().optional(),
  actualizado_en: z.string().optional()
});

export const TemplateListSchema = z.object({
  exito: z.boolean(),
  data: z.array(z.object({
    id: z.number(),
    nombre: z.string()
  }))
});

export const TemplateCreateSchema = z.object({
  exito: z.boolean(),
  data: TemplateSchema
});

export const TemplateDeleteSchema = z.object({
  exito: z.boolean(),
  mensaje: z.string()
});

export function expectValidTemplateResponse(res, schema = TemplateListSchema) {
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(500);
  const body = res.body;
  expect(schema.safeParse(body).success).toBe(true);
  if (!schema.safeParse(body).success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(schema.safeParse(body).error.issues)}`);
  }
  return body;
}
