// routes/feedback.js - Feedback generation and management endpoints
const express = require('express');
const router = express.Router();
const { verifyLTIToken, authorizeRoles, isTeacherOrAdmin } = require('../middleware/lti');
const { feedbackGenerationLimiter, templateLimiter } = require('../middleware/rateLimiter');
const feedbackService = require('../services/feedbackService');
const { Feedback, FeedbackReview } = require('../models');
const { errors } = require('../middleware/errorHandler');

// All routes require LTI authentication
router.use(verifyLTIToken);

// RF01: Generate feedback automatically
router.post('/generate', 
  authorizeRoles('teacher', 'admin'),
  feedbackGenerationLimiter,
  async (req, res) => {
    try {
      const { studentId, assignmentId, courseId, grade, overrideTemplateId } = req.body;
      
      const teacherId = req.user.userId;
      
      const feedback = await feedbackService.generateFeedback({
        studentId,
        assignmentId,
        courseId,
        grade: parseFloat(grade),
        teacherId,
        overrideTemplateId
      });

      res.status(201).json({
        success: true,
        feedback: {
          id: feedback.id,
          content: feedback.content,
          grade: feedback.grade,
          gradeRange: feedback.gradeRange,
          status: feedback.status,
          generatedAt: feedback.createdAt,
          modelUsed: feedback.aiModelUsed
        }
      });
    } catch (error) {
      errors.internal(error.message);
    }
  }
);

// RF23: List pending feedbacks for review
router.get('/pending', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { courseId, assignmentId, limit = 50, offset = 0 } = req.query;
      const teacherId = req.user.userId;
      
      const whereClause = { status: 'pending' };
      if (courseId) whereClause.courseId = courseId;
      if (assignmentId) whereClause.assignmentId = assignmentId;
      if (req.user.role === 'teacher') {
        whereClourseId = { [Op.or]: [ { teacherId }, { courseId: { [Op.in]: await getTeacherCourses(teacherId) } } ] };
      }
      
      const feedbacks = await Feedback.findAll({
        where: whereClause,
        include: [
          { model: require('../models').User, as: 'student', attributes: ['id', 'name', 'email'] },
          { model: require('../models').Assignment, attributes: ['id', 'name'] }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      const total = await Feedback.count({ where: whereClause });

      res.json({
        feedbacks: feedbacks.map(f => ({
          id: f.id,
          studentName: f.student?.name,
          studentId: f.studentId,
          assignmentId: f.assignmentId,
          assignmentName: f.assignment?.name,
          grade: f.grade,
          gradeRange: f.gradeRange,
          content: f.content,
          status: f.status,
          createdAt: f.createdAt
        })),
        total,
        pagination: { limit: parseInt(limit), offset: parseInt(offset) }
      });
    } catch (error) {
      console.error('Error fetching pending feedbacks:', error);
      res.status(500).json({ error: 'Failed to fetch pending feedbacks' });
    }
  }
);

// RF24: Get feedback detail by ID
router.get('/:id', 
  authorizeRoles('teacher', 'admin', 'student'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.role;
      
      const feedback = await Feedback.findByPk(id, {
        include: [
          { model: require('../models').User, as: 'student' },
          { model: require('../models').User, as: 'teacher' },
          { model: require('../models').Assignment }
        ]
      });

      if (!feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      // Authorization: student can only see own feedback
      if (userRole === 'student' && feedback.studentId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({
        id: feedback.id,
        student: feedback.student,
        teacher: feedback.teacher,
        assignment: feedback.assignment,
        grade: feedback.grade,
        gradeRange: feedback.gradeRange,
        content: feedback.content,
        editedContent: feedback.editedContent,
        aiModelUsed: feedback.aiModelUsed,
        tokensUsed: feedback.tokensUsed,
        generationTimeMs: feedback.generationTimeMs,
        status: feedback.status,
        qualityRating: feedback.qualityRating,
        studentUtilityRating: feedback.studentUtilityRating,
        studentUtilityFeedback: feedback.studentUtilityFeedback,
        sentAt: feedback.sentAt,
        createdAt: feedback.createdAt,
        studentContext: feedback.studentContext,
        personalizationVariables: feedback.personalizationVariables,
        reviews: feedback.FeedbackReviews || []
      });
    } catch (error) {
      console.error('Error fetching feedback:', error);
      res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  }
);

// RF25: Edit feedback text before sending
router.put('/:id/edit', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { editedContent } = req.body;
      const teacherId = req.user.userId;
      
      const feedback = await Feedback.findByPk(id);
      if (!feedback) return res.status(404).json({ error: 'Not found' });
      
      // Capture previous content for audit
      const previousContent = feedback.content;
      
      feedback.editedContent = editedContent;
      feedback.status = 'edited';
      await feedback.save();

      // Record review
      await FeedbackReview.create({
        feedbackId: id,
        reviewedBy: teacherId,
        action: 'edited',
        previousContent,
        newContent: editedContent
      });

      res.json({ 
        success: true, 
        feedback: {
          id: feedback.id,
          content: feedback.content,
          editedContent: feedback.editedContent,
          status: feedback.status
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to edit feedback' });
    }
  }
);

// RF26: Approve feedback (send to student)
router.post('/:id/approve', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const teacherId = req.user.userId;
      
      const feedback = await feedbackService.approveFeedback(id, teacherId);
      
      // Post to Canvas as comment
      await feedbackService.postToCanvas(feedback);
      
      res.json({ 
        success: true, 
        status: feedback.status,
        sentAt: feedback.sentAt,
        canvasCommentId: feedback.canvasCommentId
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to approve feedback' });
    }
  }
);

// RF27: Reject feedback and request regeneration
router.post('/:id/reject', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const teacherId = req.user.userId;
      
      await feedbackService.rejectFeedback(id, teacherId, reason);
      
      res.json({ success: true, status: 'rejected' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reject feedback' });
    }
  }
);

// RF28: Mass approval
router.post('/batch-approve', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { feedbackIds } = req.body;
      const teacherId = req.user.userId;
      
      const results = await Promise.allSettled(
        feedbackIds.map(id => feedbackService.approveFeedback(id, teacherId))
      );
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;
      
      res.json({
        success: true,
        total: feedbackIds.length,
        succeeded: successCount,
        failed: failedCount
      });
    } catch (error) {
      res.status(500).json({ error: 'Batch approval failed' });
    }
  }
);

// RF32: Student history
router.get('/student/:studentId/history', 
  authorizeRoles('teacher', 'admin', 'student'),
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { courseId, limit = 20 } = req.query;
      
      const whereClause = { studentId };
      if (courseId) whereClourseId = courseId;
      
      const history = await Feedback.findAll({
        where: whereClause,
        where: { studentId, status: 'sent' },
        order: [['sentAt', 'DESC']],
        limit: parseInt(limit),
        include: [
          { model: require('../models').Assignment, attributes: ['id', 'name'] },
          { model: require('../models').Course, attributes: ['id', 'name'] }
        ]
      });

      res.json({
        history: history.map(h => ({
          id: h.id,
          assignmentName: h.assignment?.name,
          courseName: h.course?.name,
          grade: h.grade,
          content: h.content,
          sentAt: h.sentAt,
          utilityRating: h.studentUtilityRating
        }))
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }
);

// RF33: Student rates feedback utility
router.post('/:id/rate', 
  authorizeRoles('student'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { rating, feedbackText } = req.body;
      const studentId = req.user.userId;
      
      const feedback = await Feedback.findByPk(id);
      if (!feedback || feedback.studentId !== studentId) {
        return res.status(404).json({ error: 'Feedback not found' });
      }
      
      feedback.studentUtilityRating = rating;
      feedback.studentUtilityFeedback = feedbackText;
      await feedback.save();
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to rate feedback' });
    }
  }
);

module.exports = router;
