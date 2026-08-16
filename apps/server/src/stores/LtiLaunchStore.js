import logger from '../utils/logger.js';

const TTL_SECONDS = 600;

let memoryStore = process.env.REDIS_URL ? null : new Map();

let redisClient = null;

export async function initLtiStore() {
  if (process.env.REDIS_URL && !redisClient) {
    try {
      const { createClient } = await import('redis');
      redisClient = createClient({ url: process.env.REDIS_URL });
      await redisClient.connect();
      logger.info('LTI Launch Store initialized with Redis', { url: process.env.REDIS_URL });
    } catch (err) {
      logger.warn('Redis connection failed, using memory store', { error: err.message });
      memoryStore = new Map();
    }
  }
}

export async function setLtiState(key, value) {
  const payload = JSON.stringify(value);
  if (redisClient) {
    await redisClient.setEx(key, TTL_SECONDS, payload);
  } else if (memoryStore) {
    memoryStore.set(key, payload);
    const t = setTimeout(() => memoryStore.delete(key), TTL_SECONDS * 1000);
    if (t.unref) t.unref();
    if (memoryStore.size > 5000) {
      const oldest = memoryStore.keys().next().value;
      memoryStore.delete(oldest);
    }
  }
}

export async function getLtiState(key) {
  if (redisClient) {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } else if (memoryStore) {
    const data = memoryStore.get(key);
    return data ? JSON.parse(data) : null;
  }
  return null;
}

export async function delLtiState(key) {
  if (redisClient) {
    await redisClient.del(key);
  } else if (memoryStore) {
    memoryStore.delete(key);
  }
}