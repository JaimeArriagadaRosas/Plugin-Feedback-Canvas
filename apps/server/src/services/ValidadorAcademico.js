/**
 * Academic Validator
 * Processes historical and current data to generate a student performance profile.
 */
export default class ValidadorAcademico {
  /**
   * Generates summary psychopedagogical profile based on history
   * @param {Array} history - List of previous grades and feedbacks
   */
  static generateStudentProfile(history) {
    if (!history || history.length === 0) {
      return { level: 'New', trend: 'Neutral', advice: 'No previous data.' };
    }

    const grades = history.map(h => parseFloat(h.grade) || 0);
    const average = grades.reduce((a, b) => a + b, 0) / grades.length;
    
    // Calculate trend (simplified)
    const recent = grades.slice(0, 3);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const trend = recentAvg > average ? 'Improving' : (recentAvg < average ? 'Dropping' : 'Stable');

    let level = 'Average';
    if (average >= 90) level = 'Outstanding';
    else if (average < 60) level = 'At Risk';

    return {
      average: average.toFixed(1),
      level,
      trend,
      totalSubmissions: history.length
    };
  }

  /**
   * Validates if student qualifies for special reinforcement feedback
   */
  static needsReinforcement(profile) {
    return profile.level === 'At Risk' || profile.trend === 'Dropping';
  }
}
