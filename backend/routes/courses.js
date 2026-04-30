// routes/courses.js - Course and Assignment management (RF38-RF41)
const express = require('express');
const router = express.Router();
const { verifyLTIToken, authorizeRoles, isTeacherOrAdmin } = require('../middleware/lti');
const canvasService = require('../services/canvasService');
const { Course, Assignment, CourseAssignmentConfig, PersonalizationVar } = require('../models');
const feedbackService = require('../services/feedbackService');

router.use(verifyLTIToken);

// RF38: Get courses for teacher
router.get('/courses', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      // Use Canvas API to get courses
      const canvas = new canvasService(
        process.env.CANVAS_URL,
        req.headers['x-canvas-token'] || req.user.accessToken
      );
      
      const canvasCourses = await canvas.getTeacherCourses();
      
      // Sync with local DB
      const syncedCourses = await Promise.all(
        canvasCourses.map(async (c) => {
          let course = await Course.findOne({ where: { canvasCourseId: c.id.toString() } });
          if (!course) {
            course = await Course.create({
              canvasCourseId: c.id.toString(),
              name: c.name,
              courseCode: c.course_code,
              teacherId: req.user.userId
            });
          }
          return course;
        })
      );

      res.json({
        courses: syncedCourses.map(c => ({
          id: c.id,
          canvasCourseId: c.canvasCourseId,
          name: c.name,
          courseCode: c.courseCode,
          isPluginActive: c.isPluginActive
        }))
      });
    } catch (error) {
      console.error('Error fetching courses:', error);
      res.status(500).json({ error: 'Failed to fetch courses' });
    }
  }
);

// RF39: Get assignments with rubrics
router.get('/courses/:courseId/assignments', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      
      const canvas = new canvasService(
        process.env.CANVAS_URL,
        req.headers['x-canvas-token']
      );
      
      const assignments = await canvas.getAssignmentsWithRubric(parseInt(courseId));
      
      // Map to simplified format
      const simplified = assignments.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        dueAt: a.due_at,
        pointsPossible: a.points_possible,
        hasRubric: a.rubric && a.rubric.length > 0,
        rubric: a.rubric
      }));

      res.json({ assignments: simplified });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  }
);

// RF40: Enable/disable plugin per assignment
router.post('/assignments/:assignmentId/config', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const { isActive, autoGenerateEnabled, requireApproval, templateSetId } = req.body;
      
      let config = await CourseAssignmentConfig.findOne({
        where: { assignmentId }
      });
      
      if (!config) {
        // Get courseId from assignment
        const assignment = await Assignment.findByPk(assignmentId);
        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
        
        config = await CourseAssignmentConfig.create({
          courseId: assignment.courseId,
          assignmentId: parseInt(assignmentId),
          isActive: isActive ?? false,
          autoGenerateEnabled: autoGenerateEnabled ?? true,
          requireApproval: requireApproval ?? true,
          templateSetId: templateSetId
        });
      } else {
        await config.update({
          isActive: isActive ?? config.isActive,
          autoGenerateEnabled: autoGenerateEnabled ?? config.autoGenerateEnabled,
          requireApproval: requireApproval ?? config.requireApproval,
          templateSetId: templateSetId || config.templateSetId
        });
      }

      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update config' });
    }
  }
);

// RF41: Get submissions for grading
router.get('/assignments/:assignmentId/submissions', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { courseId } = req.query;
      if (!courseId) {
        return res.status(400).json({ error: 'courseId required' });
      }
      
      const canvas = new canvasService(
        process.env.CANVAS_URL,
        req.headers['x-canvas-token']
      );
      
      const submissions = await canvas.getAssignmentSubmissions(
        parseInt(courseId),
        parseInt(req.params.assignmentId)
      );

      // Filter only graded submissions (where grade exists)
      const gradedSubmissions = submissions.filter(s => s.grade !== null && s.grade !== undefined);
      
      const result = await Promise.all(
        gradedSubmissions.map(async (sub) => {
          // Check if feedback already exists
          const existingFeedback = await Feedback.findOne({
            where: {
              studentId: sub.user_id,
              assignmentId: req.params.assignmentId
            }
          });

          return {
            submissionId: sub.id,
            userId: sub.user_id,
            userName: sub.user?.name || sub.user?.sortable_name,
            grade: parseFloat(sub.grade),
            submittedAt: sub.submitted_at,
            feedbackExists: !!existingFeedback,
            feedbackId: existingFeedback?.id,
            feedbackStatus: existingFeedback?.status
          };
        })
      );

      res.json({ submissions: result });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  }
);

// RF34: Get personalization variables for course
router.get('/courses/:courseId/personalization', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      
      const variables = await PersonalizationVar.findAll({
        where: { courseId },
        order: [['displayOrder', 'ASC']]
      });

      res.json({
        variables: variables.map(v => ({
          id: v.id,
          name: v.variableName,
          label: v.label,
          description: v.description,
          isEnabled: v.isEnabled,
          weight: v.weight,
          displayOrder: v.displayOrder
        }))
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch personalization vars' });
    }
  }
);

// RF35: Update personalization variables
router.put('/courses/:courseId/personalization', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { variables } = req.body; // Array of {variableName, isEnabled, weight}
      
      // Validate sum of weights = 100
      const enabledVars = variables.filter(v => v.isEnabled);
      const totalWeight = enabledVars.reduce((sum, v) => sum + (v.weight || 0), 0);
      
      if (Math.abs(totalWeight - 100) > 0.1) {
        return res.status(400).json({ 
          error: 'Total weight must equal 100%', 
          totalWeight 
        });
      }
      
      // Update each variable
      for (const v of variables) {
        await PersonalizationVar.upsert({
          courseId,
          variableName: v.variableName,
          label: v.label,
          description: v.description,
          isEnabled: v.isEnabled,
          weight: v.weight,
          displayOrder: v.displayOrder || 0
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update personalization' });
    }
  }
);

module.exports = router;
