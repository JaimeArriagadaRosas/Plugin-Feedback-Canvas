import logger from '../utils/logger.js';
import { nowIso } from '../utils/datetime.js';

/**
 * Academic History Service
 * Coordinates fetching data from Canvas and local persistence of the history.
 */
export default class AcademicHistoryService {
  constructor(canvasGateway, studentRepo) {
    this.canvasGateway = canvasGateway;
    this.studentRepo = studentRepo;
  }

  /**
   * Fetches and processes a student's history in a specific course.
   * Phase 8 and 9: Download real submissions from Canvas.
   */
  async getStudentAcademicProfile(courseId, studentId, teacherToken = null) {
    // Try to get from local cache first (if applicable)
    // To reflect the real and fresh history, we query Canvas.
    
    let submissions = [];
    let assignmentsMap = {};
    try {
      submissions = await this.canvasGateway.getStudentSubmissions(courseId, studentId, teacherToken);
      try {
        const assignments = await this.canvasGateway.getAssignments(courseId, teacherToken);
        assignments.forEach(a => {
          assignmentsMap[a.id] = { name: a.name, points_possible: a.points_possible };
        });
      } catch (aErr) {
        logger.warn(`[AcademicHistoryService] Could not fetch assignments: ${aErr.message}`);
      }
    } catch (err) {
      logger.warn(`[AcademicHistoryService] Could not fetch Canvas submission history: ${err.message}`);
      // Fallback to database if Canvas fails
      const cached = await this.studentRepo.getHistory(studentId, courseId);
      if (cached && cached.length > 0) {
        return {
          history: cached,
          trend: this._calculateTrend(cached),
          source: 'cache'
        };
      }
      return { history: [], trend: 'NONE', source: 'empty' };
    }

    // Filter submissions that have no score and map them
    const validHistory = submissions
      .filter(sub => sub.score !== null && sub.score !== undefined)
      .map(sub => {
        const assignmentInfo = assignmentsMap[sub.assignment_id] || {};
        return {
          assignmentId: sub.assignment_id,
          assignmentName: sub.assignment?.name || assignmentInfo.name || `Assignment ${sub.assignment_id}`,
          grade: sub.score,
          pointsPossible: sub.assignment?.points_possible || assignmentInfo.points_possible || 100,
          date: sub.submitted_at || sub.graded_at || nowIso()
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // Chronological order (oldest first)

    const trend = this._calculateTrend(validHistory);

    // Save to DB for offline read cache
    if (validHistory.length > 0) {
      this.studentRepo.updateHistory(studentId, courseId, validHistory).catch(e => {
         logger.error(`Error saving history to cache: ${e.message}`);
      });
    }

    return {
      history: validHistory,
      trend,
      source: 'canvas'
    };
  }

  /**
   * Phase 9: Analyzes the student's trajectory
   * Compares recent performance to define a trend.
   */
  _calculateTrend(history) {
    if (!history || history.length < 2) return 'NONE';

    // We take the last two grades as a simple baseline for the trend
    const last = history[history.length - 1];
    const prev = history[history.length - 2];

    // Normalize to percentage
    const lastPct = (last.grade / (last.pointsPossible || 100)) * 100;
    const prevPct = (prev.grade / (prev.pointsPossible || 100)) * 100;

    const diff = lastPct - prevPct;

    if (diff >= 5) return 'UP';
    if (diff <= -5) return 'DOWN';
    return 'FLAT';
  }
}
