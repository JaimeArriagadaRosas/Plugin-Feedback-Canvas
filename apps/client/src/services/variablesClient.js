import api from '../api/apiClient';

export const variablesClient = {
  /**
   * Gets the variable configuration for a course
   */
  async getCourseVariables(courseId) {
    const response = await api.get(`/courses/${courseId}/variables`);
    return response.data;
  },

  /**
   * Saves the variable configuration for a course
   */
  async saveCourseVariables(courseId, variables) {
    const response = await api.put(`/courses/${courseId}/variables`, { variables });
    return response;
  }
};
