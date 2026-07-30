import CanvasGateway from './apps/server/src/gateways/CanvasGateway.js';
import TokenRepository from './apps/server/src/data/TokenRepository.js';
import logger from './apps/server/src/utils/logger.js';

async function check() {
  const tokenRepo = new TokenRepository();
  const canvas = new CanvasGateway(tokenRepo, 'https://localhost:8443');
  try {
    const teacherId = '3dcb2c8b-361f-4101-a1af-efd47dcf1290'; // Use the one from DB
    const courses = await canvas.getCourses(teacherId);
    logger.info("Courses for teacher:", courses);
  } catch(e) {
    logger.error("Error fetching courses:", { error: e.message });
  }
  process.exit();
}

check();
