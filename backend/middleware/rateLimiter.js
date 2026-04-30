// middleware/rateLimiter.js - Rate limiting to protect AI service
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');
const { promisify } = require('util');

// Redis client (if available)
let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
}

// Generic rate limiter using memory store (fallback)
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    // Use Redis if available, otherwise memory
    store: redisClient ? new rateLimit.RedisStore({
      client: redisClient,
      prefix: 'rl:'
    }) : undefined
  });
};

// Rate limiter for feedback generation (per user)
const feedbackGenerationLimiter = createRateLimiter(
  // 1 minute window
  60 * 1000, 
  // 30 requests max
  30, 
  'Too many feedback generation requests. Please try again later.'
);

// Rate limiter for admin operations (stricter)
const adminLimiter = createRateLimiter(
  60 * 1000,
  10,
  'Too many admin operations. Please try again later.'
);

// Rate limiter for template management
const templateLimiter = createRateLimiter(
  60 * 1000,
  50,
  'Too many template operations. Please try again later.'
);

module.exports = {
  feedbackGenerationLimiter,
  adminLimiter,
  templateLimiter
};
