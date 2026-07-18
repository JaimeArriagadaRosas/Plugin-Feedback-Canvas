import { z } from 'zod';

export const IAConfigSchema = z.object({
  id: z.number(),
  modelo_preferido: z.string(),
  prompt_base: z.string().optional(),
  actualizado_en: z.string().optional()
});

export const TokenResponseSchema = z.object({
  exito: z.boolean(),
  data: z.object({
    servicio: z.string(),
    key: z.string()
  }).optional()
});

export const ConfigSaveSchema = z.object({
  exito: z.boolean(),
  mensaje: z.string(),
  data: z.any().optional()
});

export function expectValidConfigResponse(res, schema = ConfigSaveSchema) {
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(500);
  const body = res.body;
  expect(schema.safeParse(body).success).toBe(true);
  if (!schema.safeParse(body).success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(schema.safeParse(body).error.issues)}`);
  }
  return body;
}
