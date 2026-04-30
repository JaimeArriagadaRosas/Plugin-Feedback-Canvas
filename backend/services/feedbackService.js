// services/feedbackService.js - Core feedback generation and management
const { User, Course, Assignment, Template, Feedback, FeedbackReview, PersonalizationVar, CourseAssignmentConfig, AuditLog, NotificationLog } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const aiService = require('./aiService');
const { v4: uuidv4 } = require('uuid');
const { errors } = require('../middleware/errorHandler');

class FeedbackService {
  /**
   * Generate feedback for a student submission
   * RF01, RF02, RF03, RF05
   */
  async generateFeedback(params) {
    const {
      studentId,
      assignmentId,
      courseId,
      grade,
      teacherId,
      overrideTemplateId = null
    } = params;

    // Fetch all required data
    const student = await User.findByPk(studentId);
    if (!student) throw errors.notFound('Student');

    const assignment = await Assignment.findByPk(assignmentId, {
      include: [{ model: Course }]
    });
    if (!assignment) throw errors.notFound('Assignment');

    const config = await CourseAssignmentConfig.findOne({
      where: { assignmentId }
    });

    // Check if plugin is enabled for this assignment
    if (!config?.isActive && !overrideTemplateId) {
      throw errors.forbidden('Feedback plugin not enabled for this assignment');
    }

    // Get appropriate template based on grade
    let template;
    if (overrideTemplateId) {
      template = await Template.findByPk(overrideTemplateId);
    } else {
      const gradeRange = this.determineGradeRange(grade);
      template = await this.findTemplateForRange(courseId, gradeRange, assignment.templateSetId);
    }

    if (!template) {
      throw errors.notFound('Template for grade range');
    }

    // Build student context for personalization (RF02, RF05)
    const studentContext = await this.buildStudentContext(studentId, courseId, assignment.courseId);

    // Get personalization variables (RF34-RF37)
    const personalizationSettings = await this.getPersonalizationSettings(courseId);

    // Generate using AI
    const aiResult = await aiService.generateFeedback({
      studentName: student.name,
      grade,
      gradeRange: this.determineGradeRangeKey(grade),
      studentContext,
      template,
      provider: config?.aiProvider || 'openai'
    });

    // Create feedback record
    const feedback = await Feedback.create({
      studentId,
      teacherId,
      assignmentId,
      courseId,
      grade,
      gradeRange: this.determineGradeRangeKey(grade),
      content: aiResult.content,
      aiModelUsed: aiResult.modelUsed,
      tokensUsed: aiResult.tokensUsed,
      generationTimeMs: aiResult.generationTimeMs,
      promptUsed: aiResult.promptUsed,
      studentContext,
      personalizationVariables: personalizationSettings,
      templateId: template.id,
      status: 'pending'
    });

    // Track template usage
    await template.increment('usageCount');
    template.lastUsedAt = new Date();
    await template.save();

    // Create initial review record
    await FeedbackReview.create({
      feedbackId: feedback.id,
      reviewedBy: teacherId,
      action: 'viewed'
    });

    // Log generation
    await this.logAudit({
      userId: teacherId,
      action: 'feedback_generated',
      entityType: 'feedback',
      entityId: feedback.id,
      details: { grade, gradeRange: feedback.gradeRange, templateId: template.id },
      outcome: 'success'
    });

    return feedback;
  }

  /**
   * Build student context for personalization
   */
  async buildStudentContext(studentId, courseId, canvasCourseId) {
    // Get student's grades in this course
    const previousGrades = await Feedback.findAll({
      where: { studentId, courseId, status: 'sent' },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const gradeHistory = previousGrades.map(f => f.grade);

    // Get course average (mock for now, would be from Canvas API)
    // In production: call Canvas API for grade distribution
    const courseAverage = this.calculateMockCourseAverage(gradeHistory);

    // Get other courses performance (placeholder)
    const otherCourses = await this.getOtherCoursesPerformance(studentId);

    return {
      history: gradeHistory,
      courseAverage,
      otherCourses,
      variables: {
        trend: this.calculateTrend(gradeHistory),
        consistency: this.calculateConsistency(gradeHistory)
      }
    };
  }

  determineGradeRange(grade) {
    const { gradeRanges } = aiConfig;
    if (grade >= gradeRanges.excellent.min) return gradeRanges.excellent.label;
    if (grade >= gradeRanges.satisfactory.min) return gradeRanges.satisfactory.label;
    return gradeRanges.needsImprovement.label;
  }

  determineGradeRangeKey(grade) {
    if (grade >= 6.0) return 'excellent';
    if (grade >= 4.0) return 'satisfactory';
    return 'needs_improvement';
  }

  async findTemplateForRange(courseId, rangeLabel, templateSetId = null) {
    const whereClause = { 
      gradeRange: rangeLabel,
      isActive: true
    };

    if (courseId) {
      whereClause.courseId = courseId;
    }
    
    if (templateSetId) {
      // Find all templates in the set that match
      const templates = await Template.findAll({ where: whereClause });
      return templates[0]; // For now, first match. Could implement priority
    }

    return Template.findOne({ where: whereClause });
  }

  async getPersonalizationSettings(courseId) {
    const vars = await PersonalizationVar.findAll({
      where: { courseId, isEnabled: true },
      order: [['weight', 'DESC']]
    });

    return vars.map(v => ({
      name: v.variableName,
      label: v.label,
      weight: v.weight
    }));
  }

  async approveFeedback(feedbackId, teacherId, editedContent = null) {
    const feedback = await Feedback.findByPk(feedbackId);
    if (!feedback) throw errors.notFound('Feedback');

    // Update status
    feedback.status = 'edited';
    
    if (editedContent) {
      feedback.editedContent = editedContent;
    }

    await feedback.save();

    // Record review
    await FeedbackReview.create({
      feedbackId,
      reviewedBy: teacherId,
      action: editedContent ? 'edited' : 'approved',
      previousContent: feedback.content,
      newContent: editedContent || feedback.content
    });

    // If final approval, send to Canvas
    if (!editedContent) {
      feedback.status = 'sent';
      feedback.sentAt = new Date();
      await feedback.save();

      // Trigger notification
      await this.sendNotification(feedback);
    }

    return feedback;
  }

  async rejectFeedback(feedbackId, teacherId, reason) {
    const feedback = await Feedback.findByPk(feedbackId);
    if (!feedback) throw errors.notFound('Feedback');

    feedback.status = 'rejected';
    await feedback.save();

    await FeedbackReview.create({
      feedbackId,
      reviewedBy: teacherId,
      action: 'rejected',
      reason
    });

    return feedback;
  }

  async sendNotification(feedback) {
    // Implementation - create NotificationLog entry
    // In production, would trigger Canvas notification
    await NotificationLog.create({
      recipientId: feedback.studentId,
      senderId: feedback.teacherId,
      feedbackId: feedback.id,
      subject: 'Nuevo Feedback Disponible',
      body: `Tienes nuevo feedback en la asignatura.`,
      channel: 'in_app',
      status: 'pending'
    });
  }

  calculateMockCourseAverage(history) {
    if (history.length === 0) return 5.0;
    const sum = history.reduce((a, b) => a + b, 0);
    return sum / history.length;
  }

  calculateTrend(history) {
    if (history.length < 2) return 'estable';
    const recent = history[0];
    const previous = history[1];
    return recent > previous ? 'mejora' : recent < previous ? 'retroceso' : 'estable';
  }

  calculateConsistency(history) {
    if (history.length === 0) return 'alta';
    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    const variance = history.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / history.length;
    return variance < 1 ? 'alta' : variance < 2 ? 'media' : 'baja';
  }

  async logAudit(data) {
    const { AuditLog } = require('../models');
    await AuditLog.create(data);
  }

  /**
   * Get statistics for reports
   */
  async getStats(courseId, assignmentId = null) {
    const { sequelize, fn, col } = require('../models');
    const whereClause = { courseId };
    if (assignmentId) {
      whereClause.assignmentId = assignmentId;
    }

    const stats = await Feedback.findAll({
      where: whereClause,
      attributes: [
        'status',
        [fn('COUNT', col('id')), 'count']
      ],
      group: ['status']
    });

    return stats.reduce((acc, curr) => {
      acc[curr.status] = parseInt(curr.dataValues.count);
      return acc;
    }, {});
  }
}

module.exports = new FeedbackService();
