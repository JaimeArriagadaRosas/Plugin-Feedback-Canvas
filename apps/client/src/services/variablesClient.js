import api from '../api/apiClient';

export const variablesClient = {
  /**
   * Obtiene la configuración de variables para un curso
   */
  async getCourseVariables(courseId) {
    const response = await api.get(`/courses/${courseId}/variables`);
    return response.data;
  },

  /**
   * Guarda la configuración de variables para un curso
   */
  async saveCourseVariables(courseId, variables) {
    const response = await api.put(`/courses/${courseId}/variables`, { variables });
    return response;
  }
};
