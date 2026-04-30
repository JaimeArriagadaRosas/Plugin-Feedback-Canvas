// frontend/src/components/ReportsPanel.jsx - Reports and statistics (RF46-RF50)
import React, { useState, useEffect } from 'react';
import { useLTI } from './LTIContext';
import apiClient from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

const ReportsPanel = () => {
  const { context, token } = useLTI();
  const [dashboardData, setDashboardData] = useState(null);
  const [utilityStats, setUtilityStats] = useState(null);
  const [timeRange, setTimeRange] = useState('semester');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (context.courseId) {
      loadDashboard();
      loadUtilityStats();
    }
  }, [context.courseId, timeRange]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        `/reports/dashboard/${context.courseId}${context.assignmentId ? `/${context.assignmentId}` : ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDashboardData(response.data);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUtilityStats = async () => {
    try {
      const response = await apiClient.get(
        `/reports/utility-stats/${context.courseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUtilityStats(response.data);
    } catch (err) {
      console.error('Utility stats error:', err);
    }
  };

  const exportReport = async (format) => {
    try {
      const response = await apiClient.get(
        `/reports/export/${context.courseId}?format=${format}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Download file
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback-report-${context.courseId}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const chartColors = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div className="reports-panel">
      <div className="reports-header">
        <h2>📊 Reportes y Estadísticas</h2>
        <div className="export-buttons">
          <button className="btn btn-secondary" onClick={() => exportReport('csv')}>
            📥 Exportar CSV
          </button>
          <button className="btn btn-secondary" onClick={() => exportReport('json')}>
            📥 Exportar JSON
          </button>
        </div>
      </div>

      {dashboardData && (
        <>
          {/* Summary Stats */}
          <div className="stats-cards">
            <div className="stat-card">
              <h3>Total Feedback</h3>
              <p className="stat-value">{dashboardData.summary.total}</p>
            </div>
            <div className="stat-card">
              <h3>Promedio General</h3>
              <p className="stat-value">{dashboardData.summary.averageGrade.toFixed(1)}</p>
            </div>
            <div className="stat-card">
              <h3>Pendientes</h3>
              <p className="stat-value stat-pending">{dashboardData.summary.byStatus?.pending || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Enviados</h3>
              <p className="stat-value stat-sent">{dashboardData.summary.byStatus?.sent || 0}</p>
            </div>
          </div>

          {/* Status Distribution Pie Chart */}
          <div className="chart-section">
            <h3>Distribución por Estado</h3>
            <div className="chart-container">
              <PieChart width={400} height={300}>
                <Pie
                  data={Object.entries(dashboardData.summary.byStatus || {}).map(([name, value]) => ({ name, value }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {Object.entries(dashboardData.summary.byStatus || {}).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </div>
          </div>

          {/* Grade Range Distribution Bar Chart */}
          <div className="chart-section">
            <h3>Distribución por Rango de Calificación</h3>
            <div className="chart-container">
              <BarChart width={600} height={300} data={
                Object.entries(dashboardData.summary.byGradeRange || {}).map(([range, count]) => ({
                  range: range === 'excellent' ? 'Excelente (6-7)' :
                        range === 'satisfactory' ? 'Satisfactorio (4-5.9)' : 'Necesita Mejora (<4)',
                  count
                }))
              }>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </div>
          </div>

          {/* Utility Rating */}
          {utilityStats && (
            <div className="chart-section">
              <h3>Utilidad del Feedback Según Estudiantes</h3>
              <div className="utility-bars">
                {utilityStats.byGradeRange?.map(item => (
                  <div key={item.gradeRange} className="utility-item">
                    <span className="range-label">{item.gradeRange}</span>
                    <div className="bar-container">
                      <div 
                        className="bar-fill"
                        style={{ width: `${(item.averageUtility / 5) * 100}%` }}
                      >
                        {item.averageUtility}/5
                      </div>
                    </div>
                    <span className="count">({item.count} respuestas)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="recent-activity">
            <h3>Actividad Reciente</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Calificación</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.recentActivity?.map(activity => (
                  <tr key={activity.id}>
                    <td>{activity.studentName}</td>
                    <td>{activity.grade}</td>
                    <td>
                      <span className={`badge badge-${activity.status}`}>
                        {activity.status}
                      </span>
                    </td>
                    <td>{new Date(activity.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsPanel;
