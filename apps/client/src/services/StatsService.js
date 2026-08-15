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
      logger.error('StatsService', 'Error fetching statistics', { error: error.message });
      throw error;
    }
  },
  
  exportReport: async (format) => {
    try {
      const response = await apiClient.get(`/reports/export/${format}/all`, {
        responseType: 'blob'
      });
      
      const blob = response instanceof Blob ? response : new Blob([response]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_feedback.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      logger.error('StatsService', 'Error exporting report', { error: error.message, format });
      throw error;
    }
  }
};
