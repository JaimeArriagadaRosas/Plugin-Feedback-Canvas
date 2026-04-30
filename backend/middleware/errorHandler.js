// middleware/errorHandler.js - Centralized error handling
class AppError extends Error {
  constructor(message, statusCode, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // If error already has statusCode, use it
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Internal server error';
  
  // Don't leak error details in production
  const response = {
    error: message,
    code
  };
  
  // Add stack trace only in development
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
};

// Specific error constructors
const createError = (message, statusCode = 500, code = 'ERROR') => {
  const error = new AppError(message, statusCode, code);
  return error;
};

// Common errors
const errors = {
  notFound: (resource = 'Resource') => 
    createError(`${resource} not found`, 404, 'NOT_FOUND'),
  
  unauthorized: (message = 'Unauthorized') => 
    createError(message, 401, 'UNAUTHORIZED'),
  
  forbidden: (message = 'Forbidden') => 
    createError(message, 403, 'FORBIDDEN'),
  
  validation: (message = 'Validation failed') => 
    createError(message, 400, 'VALIDATION_ERROR'),
  
  conflict: (message = 'Conflict') => 
    createError(message, 409, 'CONFLICT'),
  
  internal: (message = 'Internal server error') => 
    createError(message, 500, 'INTERNAL_ERROR'),
  
  // Custom errors
  aiServiceUnavailable: () => 
    createError('AI service unavailable. Please try again later or use manual mode.', 
                503, 'AI_SERVICE_UNAVAILABLE'),
  
  canvasApiError: (details) => 
    createError(`Canvas API error: ${details}`, 502, 'CANVAS_API_ERROR'),
  
  invalidGradeRange: (grade) => 
    createError(`Invalid grade range for ${grade}`, 400, 'INVALID_GRADE_RANGE'),
  
  templateIncomplete: () => 
    createError('Template must cover all grade ranges', 400, 'INCOMPLETE_TEMPLATE'),
  
  insufficientHistory: () => 
    createError('Insufficient student history for personalization', 
                400, 'INSUFFICIENT_HISTORY')
};

module.exports = {
  errorHandler,
  AppError,
  createError,
  errors
};
