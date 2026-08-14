import logger from '../../utils/logger.js';

/**
 * Concurrency controller for massive feedback generation.
 * Applies the Single Responsibility Principle (SRP) separating flow control
 * from individual feedback generation.
 */
export default class MassiveGenerationOrchestrator {
  constructor(feedbackGenerationService) {
    this.generationService = feedbackGenerationService;
    // Safety delay between requests to respect quota limits (e.g., Gemini Free: 15 RPM)
    this.delayMs = 4000;
  }

  /**
   * Processes the student queue asynchronously with artificial delays
   */
  async execute(courseId, activeAssignments, students, teacherId, isRegenerate = false) {
    // Executes in background without blocking the HTTP response
    setTimeout(async () => {
      logger.info(`[Orchestrator] Starting massive generation for ${activeAssignments.length} assignments and ${students.length} students.`);
      
      for (const assignment of activeAssignments) {
        for (const student of students) {
          try {
            await this.generationService.generateFeedback(
              courseId, 
              assignment.id, 
              student.id, 
              assignment.templateId || 1, 
              undefined, 
              teacherId, 
              { isRegenerate }
            );
          } catch (e) {
            logger.error(`[Orchestrator] Error in massive generation for student ${student.id} in assignment ${assignment.id}: ${e.message}`);
          }
        }
      }
      
      logger.info(`[Orchestrator] Massive generation completed.`);
    }, 0);
  }
}
