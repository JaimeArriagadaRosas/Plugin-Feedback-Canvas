import apiClient from '../api/apiClient';
import logger from '../utils/logger';

export const StatsService = {
  fetchStats: async () => {
    try {
      const [statsRes, ratingsRes] = await Promise.all([
        apiClient.get(`/reports/stats/all`),
        apiClient.get(`/reports/ratings/all`)
      ]);
      return {
        stats: statsRes.data,
        ratings: ratingsRes.data || []
      };
    } catch (error) {
      logger.error('StatsService', 'Error al obtener estadísticas', { error: error.message });
      throw error;
    }
  },
  
  exportReport: async (format) => {
    try {
      const response = await apiClient.get(`/reports/export/${format}/all`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_feedback.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      logger.error('StatsService', 'Error al exportar reporte', { error: error.message, format });
      throw error;
    }
  }
};
