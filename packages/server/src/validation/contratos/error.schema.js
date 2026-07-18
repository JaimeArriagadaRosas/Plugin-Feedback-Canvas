import { z } from 'zod';

export const ApiErrorSchema = z.object({
  exito: z.literal(false),
  error: z.object({
    mensaje: z.string(),
    codigo: z.number(),
    timestamp: z.string().optional(),
    path: z.string().optional()
  })
});

export function expectErrorResponse(res, expectedStatus = 401) {
  expect(res.status).toBe(expectedStatus);
  const body = res.body;
  expect(ApiErrorSchema.safeParse(body).success).toBe(true);
  expect(body.exito).toBe(false);
  expect(body.error).toBeDefined();
  expect(body.error.codigo).toBe(expectedStatus);
  return body;
}
