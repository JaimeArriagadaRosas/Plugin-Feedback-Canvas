import { z } from 'zod';

/**
 * Validación de entrada con Zod (runtime).
 *
 * Corrige la validación inconsistente detectada: muchos POST/PUT no validaban el
 * body y la defensa contra mass-assignment (validateKnownFields) nunca se usaba.
 * Aquí se validan body + se rechazan campos no permitidos en un solo middleware.
 *
 * OWASP A03 (Injection) / A04 (Insecure Design): never trust user input.
 */

const idNum = z.coerce.number().int().positive();

export const schemas = {
  feedbackGenerate: z.object({
    courseId: idNum,
    assignmentId: idNum,
    studentId: idNum,
    templateId: idNum.optional(),
    grade: z.union([
      z.string().min(1).transform(v => Number(v)).pipe(z.number().min(0).max(100)),
      z.number().min(0).max(100)
    ]).optional(),
  }).strict(),
  feedbackApprove: z.object({
    feedbackId: idNum.optional(),
    courseId: idNum.optional(),
    assignmentId: idNum.optional(),
    studentId: idNum.optional(),
    content: z.string().min(1).max(20000).optional(),
    rating: z.number().min(1).max(5).nullable().optional(),
    grade: z.union([z.string().min(1), z.number()]).optional(),
  }).strict(),
  feedbackManual: z.object({
    courseId: idNum,
    assignmentId: idNum,
    studentId: idNum,
    content: z.string().min(1).max(20000),
    templateId: idNum.optional(),
  }).strict(),
  iaModel: z.object({
    servicio: z.string().min(1).max(64),
    modelo: z.string().min(1).max(64),
    temperatura: z.number().min(0).max(2).optional(),
    longitud_maxima: z.number().int().min(1).max(8192).optional(),
    endpoint_api: z.string().max(2048).optional(),
  }),
  iaToken: z.object({
    servicio: z.string().min(1).max(64),
    key: z.string().min(1),
  }),
  iaAdvancedConfig: z.object({
    modelo_preferido: z.string().min(1).max(64).optional(),
    prompt_base: z.string().max(20000).optional(),
    temperature: z.number().min(0).max(1).optional(),
  }),
  courseVariables: z
    .object({ config_json: z.record(z.unknown()) })
    .or(z.record(z.unknown())),
  studentRate: z.object({
    id: idNum,
    rating: z.number().min(1).max(5),
  }),
  localRole: z.object({
    role: z.enum(['admin', 'teacher', 'student']),
  }),
  templateCreate: z.object({
    nombre: z.string().min(1).max(255),
    descripcion: z.string().max(1000).optional(),
    contenido: z.string().min(1)
  }).strict(),
  templateUpdate: z.object({
    nombre: z.string().min(1).max(255).optional(),
    descripcion: z.string().max(1000).optional(),
    contenido: z.string().min(1).optional()
  }).strict(),
  feedbackUpdate: z.object({
    nuevoContenido: z.string().min(1).max(20000),
  }).strict(),
};

/**
 * Middleware que valida el body contra un esquema Zod y opcionalmente bloquea
 * mass-assignment (campos fuera de allowedFields).
 */
export function validateBody(schema, allowedFields) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        exito: false,
        error: {
          mensaje: 'Validación de entrada fallida',
          codigo: 400,
          detalles: result.error.issues.map((i) => ({
            campo: i.path.join('.'),
            mensaje: i.message,
          })),
        },
      });
    }

    if (allowedFields) {
      const extra = Object.keys(req.body || {}).filter(
        (f) => !allowedFields.includes(f)
      );
      if (extra.length > 0) {
        return res.status(400).json({
          exito: false,
          error: {
            mensaje: `Campos no permitidos: ${extra.join(', ')}`,
            codigo: 400,
          },
        });
      }
    }

    req.validated = result.data;
    next();
  };
}

export function requireDeploymentId(req, res, next) {
  const deploymentId = req.ltiContext?.deploymentId;
  const isLocal = req.ltiContext?.isLocalSession;
  if (!isLocal && !deploymentId) {
    return res.status(403).json({
      exito: false,
      error: {
        mensaje: 'Falta deployment_id en el contexto LTI',
        codigo: 403
      }
    });
  }
  next();
}
