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
      logger.info('LTI Launch Store inicializado con Redis', { url: process.env.REDIS_URL });
    } catch (err) {
      logger.warn('Falló conexión Redis, usando store en memoria', { error: err.message });
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
    setTimeout(() => memoryStore.delete(key), TTL_SECONDS * 1000);
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