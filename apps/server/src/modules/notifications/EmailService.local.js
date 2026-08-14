import logger from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';

export default class EmailServiceLocal {
  constructor() {
    this.logFilePath = path.join(process.cwd(), 'local-emails.log');
  }

  async sendNotification(studentId, courseId, asunto) {
    const message = `[MOCK EMAIL] To: Student ${studentId} | Course: ${courseId} | Asunto: ${asunto} | Fecha: ${new Date().toISOString()}\n`;
    
    // Loguear en consola
    logger.info(message.trim());
    
    // Guardar en archivo local
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.appendFileSync(this.logFilePath, message);
    } catch (err) {
      logger.error('Error escribiendo log de email local:', err);
      throw err;
    }
  }
}
