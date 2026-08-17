import logger from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';

export default class EmailServiceLocal {
  constructor() {
    this.logFilePath = path.join(process.cwd(), 'logs', 'local-emails.log');
  }

  async sendNotification(estudianteId, courseId, asunto) {
    const message = `[MOCK EMAIL] To: Student ${estudianteId} | Course: ${courseId} | Subject: ${asunto} | Date: ${new Date().toISOString()}\n`;
    
    // Log to console
    logger.info(message.trim());
    
    // Save to local file
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.appendFileSync(this.logFilePath, message);
    } catch (err) {
      logger.error('Error writing local email log:', err);
      throw err;
    }
  }
}
