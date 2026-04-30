// routes/reports.js - Reports and statistics (RF46-RF50)
const express = require('express');
const router = express.Router();
const { verifyLTIToken, authorizeRoles } = require('../middleware/lti');
const { Feedback, Course, Assignment } = require('../models');
const { Op } = require('sequelize');

router.use(verifyLTIToken);

// RF46, RF47: Get statistics dashboard
router.get('/dashboard/:courseId?/:assignmentId?', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { courseId, assignmentId } = req.params;
      
      const whereClause = {};
      if (courseId) whereClause.courseId = courseId;
      if (assignmentId) whereClause.assignmentId = assignmentId;
      
      // Total counts by status
      const statusCounts = await Feedback.findAll({
        where: whereClourse,
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['status']
      });

      // Count by grade range
      const rangeCounts = await Feedback.findAll({
        where: whereClause,
        attributes: [
          'gradeRange',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['gradeRange']
      });

      // Quality ratings distribution
      const qualityCounts = await Feedback.findAll({
        where: { ...whereClause, qualityRating: { [Op.ne]: null } },
        attributes: [
          'qualityRating',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['qualityRating']
      });

      // Student utility distribution
      const utilityCounts = await Feedback.findAll({
        where: { ...whereClause, studentUtilityRating: { [Op.ne]: null } },
        attributes: [
          'studentUtilityRating',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['studentUtilityRating']
      });

      // Average grade
      const avgResult = await Feedback.findOne({
        where: whereClause,
        attributes: [[require('sequelize').fn('AVG', require('sequelize').col('grade')), 'avgGrade']]
      });

      // Recent activity
      const recent = await Feedback.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: 10,
        include: [
          { model: require('../models').User, as: 'student', attributes: ['id', 'name'] }
        ]
      });

      const total = await Feedback.count({ where: whereClause });
      const percentageByStatus = statusCounts.reduce((acc, curr) => {
        acc[curr.status] = ((curr.dataValues.count / total) * 100).toFixed(1);
        return acc;
      }, {});

      res.json({
        summary: {
          total,
          averageGrade: parseFloat(avgResult.dataValues.avgGrade) || 0,
          byStatus: statusCounts.reduce((acc, c) => ({ ...acc, [c.status]: parseInt(c.dataValues.count) }), {}),
          percentageByStatus,
          byGradeRange: rangeCounts.reduce((acc, c) => ({ ...acc, [c.gradeRange]: parseInt(c.dataValues.count) }), {}),
          qualityDistribution: qualityCounts.reduce((acc, c) => ({ ...acc, [c.qualityRating]: parseInt(c.dataValues.count) }), {}),
          utilityDistribution: utilityCounts.reduce((acc, c) => ({ ...acc, [c.studentUtilityRating]: parseInt(c.dataValues.count) }), {})
        },
        recentActivity: recent.map(r => ({
          id: r.id,
          studentName: r.student?.name,
          grade: r.grade,
          status: r.status,
          createdAt: r.createdAt
        }))
      });
    } catch (error) {
      console.error('Report error:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  }
);

// RF48: Export reports
router.get('/export/:courseId', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { format = 'json', assignmentId } = req.query;
      
      const whereClause = { courseId };
      if (assignmentId) whereClourseId = assignmentId;
      
      const data = await Feedback.findAll({
        where: whereClause,
        include: [
          { model: require('../models').User, as: 'student', attributes: ['name', 'email'] },
          { model: require('../models').Assignment, attributes: ['name'] }
        ],
        order: [['createdAt', 'DESC']]
      });

      if (format === 'csv' || format === 'excel') {
        // For CSV/Excel, convert to CSV format
        const csv = this.convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="feedback-report-${courseId}.csv"`);
        res.send(csv);
      } else if (format === 'pdf') {
        // Placeholder - would use a PDF library
        res.status(501).json({ error: 'PDF export not implemented yet' });
      } else {
        res.json({
          courseId,
          generatedAt: new Date().toISOString(),
          records: data.length,
          data: data.map(d => ({
            student: d.student?.name,
            email: d.student?.email,
            assignment: d.assignment?.name,
            grade: d.grade,
            gradeRange: d.gradeRange,
            status: d.status,
            qualityRating: d.qualityRating,
            sentAt: d.sentAt
          }))
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Export failed' });
    }
  }
);

// Helper: Convert to CSV
function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = ['Student', 'Email', 'Assignment', 'Grade', 'Range', 'Status', 'Quality', 'Sent At'];
  const rows = data.map(item => [
    item.student?.name || '',
    item.student?.email || '',
    item.assignment?.name || '',
    item.grade,
    item.gradeRange,
    item.status,
    item.qualityRating || '',
    item.sentAt || ''
  ]);

  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

// RF49: Grade distribution chart data
router.get('/grade-distribution/:courseId', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { bins = 10 } = req.query;
      
      const grades = await Feedback.findAll({
        where: { courseId, status: 'sent' },
        attributes: ['grade']
      });

      const values = grades.map(g => g.grade);
      const histogram = this.createHistogram(values, parseInt(bins));

      res.json({
        courseId,
        bins: histogram.bins,
        counts: histogram.counts,
        mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate histogram' });
    }
  }
);

function createHistogram(data, bins) {
  if (data.length === 0) return { bins: [], counts: [] };
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const binSize = (max - min) / bins;
  
  const binEdges = [];
  const counts = new Array(bins).fill(0);
  
  for (let i = 0; i <= bins; i++) {
    binEdges.push(min + i * binSize);
  }
  
  for (const value of data) {
    let binIndex = Math.floor((value - min) / binSize);
    if (binIndex >= bins) binIndex = bins - 1;
    counts[binIndex]++;
  }
  
  return { bins: binEdges, counts };
}

// RF50: Utility statistics
router.get('/utility-stats/:courseId', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      
      const stats = await Feedback.findAll({
        where: { 
          courseId,
          studentUtilityRating: { [Op.ne]: null }
        },
        attributes: [
          'gradeRange',
          [require('sequelize').fn('AVG', require('sequelize').col('studentUtilityRating')), 'avgUtility'],
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['gradeRange']
      });

      res.json({
        courseId,
        byGradeRange: stats.map(s => ({
          gradeRange: s.gradeRange,
          averageUtility: parseFloat(s.dataValues.avgUtility).toFixed(2),
          count: parseInt(s.dataValues.count)
        }))
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to compute utility stats' });
    }
  }
);

module.exports = router;
