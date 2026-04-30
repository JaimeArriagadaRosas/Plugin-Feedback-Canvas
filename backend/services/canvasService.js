// services/canvasService.js - Canvas LMS API integration
const axios = require('axios');

class CanvasService {
  constructor(baseUrl, accessToken) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accessToken = accessToken;
    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v1`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    const response = await this.client.get('/users/self');
    return response.data;
  }

  /**
   * Get courses where user is enrolled as teacher
   */
  async getTeacherCourses() {
    const response = await this.client.get('/courses', {
      params: {
        enrollment_type: 'teacher',
        per_page: 50,
        state: 'available'
      }
    });
    return response.data;
  }

  /**
   * Get assignments for a course
   */
  async getCourseAssignments(courseId) {
    const response = await this.client.get(`/courses/${courseId}/assignments`, {
      params: {
        per_page: 50,
        include: ['submission', 'rubric']
      }
    });
    return response.data;
  }

  /**
   * Get assignments with rubrics
   */
  async getAssignmentsWithRubric(courseId) {
    const response = await this.client.get(`/courses/${courseId}/assignments`, {
      params: {
        per_page: 50,
        include: ['rubric']
      }
    });
    return response.data.filter(a => a.rubric && a.rubric.length > 0);
  }

  /**
   * Get gradebook/gradebook entries for an assignment
   */
  async getAssignmentSubmissions(courseId, assignmentId) {
    const response = await this.client.get(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      params: {
        per_page: 100,
        include: ['user', 'submission_comments']
      }
    });
    return response.data;
  }

  /**
   * Get all students in a course
   */
  async getCourseStudents(courseId) {
    const response = await this.client.get(`/courses/${courseId}/users`, {
      params: {
        enrollment_type: 'student',
        per_page: 100,
        include: ['email', 'enrollments']
      }
    });
    return response.data;
  }

  /**
   * Get single student by ID
   */
  async getStudent(courseId, userId) {
    const response = await this.client.get(`/courses/${courseId}/users/${userId}`, {
      params: {
        include: ['enrollments', 'email']
      }
    });
    return response.data;
  }

  /**
   * Get rubric for assignment
   */
  async getRubric(courseId, assignmentId) {
    const response = await this.client.get(`/courses/${courseId}/assignments/${assignmentId}/rubric`, {
      params: {
        include: ['assessments']
      }
    });
    return response.data;
  }

  /**
   * Post comment to submission (as feedback)
   */
  async postComment(courseId, assignmentId, userId, comment, isPrivate = false) {
    const response = await this.client.post(
      `/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}/comments`,
      {
        comment: {
          text_comment: comment
        },
        hidden: isPrivate
      }
    );
    return response.data;
  }

  /**
   * Update submission grade
   */
  async updateGrade(courseId, assignmentId, userId, grade) {
    const response = await this.client.put(
      `/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
      {
        submission: {
          posted_grade: grade.toString()
        }
      }
    );
    return response.data;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    const response = await this.client.get(`/users/${userId}/profile`);
    return response.data;
  }

  /**
   * Check if user has permission to grade
   */
  async canModifyGrade(courseId, userId) {
    try {
      const enrollment = await this.client.get(`/courses/${courseId}/enrollments`, {
        params: {
          user_id: userId,
          type: 'TeacherEnrollment'
        }
      });
      return enrollment.data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get course analytics/grade distribution
   */
  async getCourseAnalytics(courseId) {
    const response = await this.client.get(`/courses/${courseId}/analytics/grade_distribution`);
    return response.data;
  }

  /**
   * Send message to user via Canvas inbox
   */
  async sendMessage(recipientIds, subject, body) {
    const response = await this.client.post('/conversations', {
      recipients: Array.isArray(recipientIds) ? recipientIds : [recipientIds],
      subject,
      body,
      group_conversation: false
    });
    return response.data;
  }

  /**
   * Check service health
   */
  async healthCheck() {
    try {
      await this.client.get('/users/self', { timeout: 5000 });
      return { status: 'healthy', service: 'canvas' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        service: 'canvas', 
        reason: error.message 
      };
    }
  }
}

module.exports = CanvasService;
