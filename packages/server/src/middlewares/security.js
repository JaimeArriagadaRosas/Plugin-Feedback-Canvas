import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';
import { AppError } from '../utils/errors.js';
import { extractLtiToken } from '../security/ltiCookie.js';

function ipKeyGenerator(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getUserRateLimitKey(req) {
  const token = extractLtiToken(req);
  if (token && !token.startsWith('dev-token')) {
    return `user:${token.substring(0, 16)}`;
  }
  const localUser = req.ltiContext?.user;
  if (localUser) {
    return `user:${localUser}`;
  }
  return ipKeyGenerator(req);
}

// Valida que el body solo contenga campos esperados (defensa contra mass assignment)
export const validateKnownFields = (allowedFields) => [
  body().custom((value, { req }) => {
    const extraFields = Object.keys(req.body || {}).filter(f => !allowedFields.includes(f));
    if (extraFields.length > 0) {
      throw new Error(`Campos no permitidos: ${extraFields.join(', ')}`);
    }
    return true;
  })
];

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserRateLimitKey,
  message: { exito: false, error: { mensaje: 'Demasiadas solicitudes. Intente más tarde.', codigo: 429 } }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserRateLimitKey,
  message: { exito: false, error: { mensaje: 'Demasiados intentos de autenticación. Intente más tarde.', codigo: 429 } }
});

export const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserRateLimitKey,
  message: { exito: false, error: { mensaje: 'Límite de webhooks excedido.', codigo: 429 } }
});

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      exito: false,
      error: {
        mensaje: 'Validación de entrada fallida',
        codigo: 400,
        detalles: errors.array().map(e => ({ campo: e.path, mensaje: e.msg }))
      }
    });
  }
  next();
};

export const validateId = (field = 'id') => [
  param(field).isInt({ min: 1 }).withMessage(`${field} debe ser un entero positivo`)
];

export const validateCourseId = [
  param('courseId').isInt({ min: 1 }).withMessage('courseId debe ser un entero positivo')
];

export const validateAssignmentId = [
  param('assignmentId').isInt({ min: 1 }).withMessage('assignmentId debe ser un entero positivo')
];

export const validateStudentId = [
  param('studentId').isInt({ min: 1 }).withMessage('studentId debe ser un entero positivo')
];

export const validateFeedbackDetailQuery = [
  query('studentId').isInt({ min: 1 }).withMessage('studentId debe ser un entero positivo'),
  query('courseId').isInt({ min: 1 }).withMessage('courseId debe ser un entero positivo')
];
