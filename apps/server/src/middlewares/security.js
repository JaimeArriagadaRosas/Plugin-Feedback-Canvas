import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';
import { extractLtiToken } from '../security/ltiCookie.js';

function ipKeyGenerator(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getUserRateLimitKey(req) {
  const token = extractLtiToken(req);
  if (token && !token.startsWith('dev-token')) {
    return `user:${token.substring(0, 16)}`;
  }
  const localUser = req.appIdentity?.canonicalUserId;
  if (localUser) {
    return `user:${localUser}`;
  }
  return ipKeyGenerator(req);
}

// Validates that the body only contains expected fields (defense against mass assignment)
export const validateKnownFields = (allowedFields) => [
  body().custom((value, { req }) => {
    const extraFields = Object.keys(req.body || {}).filter(f => !allowedFields.includes(f));
    if (extraFields.length > 0) {
      throw new Error(`Fields not allowed: ${extraFields.join(', ')}`);
    }
    return true;
  })
];

export const globalLimiter = process.env.DISABLE_RATE_LIMIT === 'true' ? (req, res, next) => next() : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserRateLimitKey,
  message: { exito: false, error: { mensaje: 'Too many requests. Try again later.', codigo: 429 } }
});

export const authLimiter = process.env.DISABLE_RATE_LIMIT === 'true' ? (req, res, next) => next() : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserRateLimitKey,
  message: { exito: false, error: { mensaje: 'Too many authentication attempts. Try again later.', codigo: 429 } }
});

export const webhookLimiter = process.env.DISABLE_RATE_LIMIT === 'true' ? (req, res, next) => next() : rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserRateLimitKey,
  message: { exito: false, error: { mensaje: 'Webhook limit exceeded.', codigo: 429 } }
});

export const studentRateLimiter = process.env.DISABLE_RATE_LIMIT === 'true' ? (req, res, next) => next() : rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 ratings per hour maximum
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserRateLimitKey,
  message: { exito: false, error: { mensaje: 'Too many rating attempts. Try again later.', codigo: 429 } }
});

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      exito: false,
      error: {
        mensaje: 'Input validation failed',
        codigo: 400,
        detalles: errors.array().map(e => ({ campo: e.path, mensaje: e.msg }))
      }
    });
  }
  next();
};

export const validateId = (field = 'id') => [
  param(field).isInt({ min: 1 }).withMessage(`${field} must be a positive integer`)
];

export const validateCourseId = [
  param('courseId').isString().notEmpty().withMessage('courseId must be provided')
];

export const validateAssignmentId = [
  param('assignmentId').isInt({ min: 1 }).withMessage('assignmentId must be a positive integer')
];

export const validateStudentId = [
  param('studentId').isString().notEmpty().withMessage('studentId must be provided')
];

export const validateFeedbackDetailQuery = [
  query('studentId').isString().notEmpty().withMessage('studentId must be provided'),
  query('courseId').isString().notEmpty().withMessage('courseId must be provided')
];
