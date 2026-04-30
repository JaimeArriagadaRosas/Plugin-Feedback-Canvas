// routes/templates.js - Template CRUD (RF09-RF15)
const express = require('express');
const router = express.Router();
const { verifyLTIToken, authorizeRoles, isTeacherOrAdmin, templateLimiter } = require('../middleware/lti');
const { Template, Course } = require('../models');
const { errors } = require('../middleware/errorHandler');

router.use(verifyLTIToken);

// RF09: List templates
router.get('/', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { courseId, gradeRange, activeOnly = true } = req.query;
      const whereClause = {};
      
      if (courseId) whereClourseId = courseId;
      if (gradeRange) whereClause.gradeRange = gradeRange;
      if (activeOnly === 'true') whereClause.isActive = true;
      
      const templates = await Template.findAll({
        where: whereClause,
        include: [
          { 
            model: require('../models').User, 
            as: 'createdByUser',
            attributes: ['id', 'name'] 
          }
        ],
        order: [['gradeRange', 'ASC'], ['name', 'ASC']]
      });

      res.json({
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          courseId: t.courseId,
          gradeRange: t.gradeRange,
          minGrade: t.minGrade,
          maxGrade: t.maxGrade,
          content: t.content,
          variables: t.variables,
          isActive: t.isActive,
          isSystem: t.isSystem,
          usageCount: t.usageCount,
          createdAt: t.createdAt,
          createdBy: t.createdByUser?.name
        }))
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  }
);

// RF10: Create template
router.post('/', 
  authorizeRoles('teacher', 'admin'),
  templateLimiter,
  async (req, res) => {
    try {
      const { name, description, courseId, gradeRange, minGrade, maxGrade, content, variables } = req.body;
      const createdBy = req.user.userId;
      
      // Validate grade range
      if (minGrade >= maxGrade) {
        return errors.validation('minGrade must be less than maxGrade');
      }
      
      const template = await Template.create({
        name,
        description,
        courseId: courseId || null,
        gradeRange,
        minGrade,
        maxGrade,
        content,
        variables: variables || ['nombre_estudiante', 'calificacion', 'promedio_curso'],
        createdBy,
        isActive: true,
        isSystem: false
      });

      // Audit log
      await require('../services/feedbackService').logAudit({
        userId: createdBy,
        action: 'template_created',
        entityType: 'template',
        entityId: template.id,
        details: { name, gradeRange }
      });

      res.status(201).json({
        success: true,
        template: {
          id: template.id,
          name: template.name,
          gradeRange: template.gradeRange
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create template' });
    }
  }
);

// RF11: Update template
router.put('/:id', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = req.user.userId;
      
      const template = await Template.findByPk(id);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      
      // Only creator or admin can edit
      if (template.createdBy !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      // Don't allow editing system templates
      if (template.isSystem) {
        return res.status(403).json({ error: 'Cannot edit system template' });
      }
      
      await template.update({
        ...updates,
        version: template.version + 1
      });

      res.json({ success: true, template });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update template' });
    }
  }
);

// RF12: Delete template
router.delete('/:id', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      
      const template = await Template.findByPk(id);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      
      if (template.isSystem) {
        return res.status(403).json({ error: 'Cannot delete system template' });
      }
      
      // Check if template is in use
      const inUse = await require('../models').CourseAssignmentConfig.count({
        where: { templateSetId: id }
      });
      
      if (inUse > 0) {
        return res.status(409).json({ 
          error: 'Template is in use by assignments', 
          count: inUse 
        });
      }
      
      await template.destroy();
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete template' });
    }
  }
);

// RF13: Template history - built in with timestamps
// RF14: Duplicate template
router.post('/:id/duplicate', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { newName } = req.body;
      
      const original = await Template.findByPk(id);
      if (!original) return res.status(404).json({ error: 'Template not found' });
      
      const duplicate = await Template.create({
        name: newName || `${original.name} (Copia)`,
        description: original.description,
        courseId: original.courseId,
        gradeRange: original.gradeRange,
        minGrade: original.minGrade,
        maxGrade: original.maxGrade,
        content: original.content,
        variables: original.variables,
        createdBy: req.user.userId,
        isActive: false, // Start inactive
        isSystem: false
      });
      
      res.status(201).json({
        success: true,
        template: {
          id: duplicate.id,
          name: duplicate.name,
          gradeRange: duplicate.gradeRange
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to duplicate template' });
    }
  }
);

// RF15: Validate template covers all ranges
router.get('/validate-complete/:courseId', 
  authorizeRoles('teacher', 'admin'),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      
      const ranges = ['excellent', 'satisfactory', 'needs_improvement'];
      const missing = [];
      
      for (const range of ranges) {
        const count = await Template.count({
          where: { 
            courseId: courseId || null, // null means global
            gradeRange: range,
            isActive: true
          }
        });
        if (count === 0) missing.push(range);
      }
      
      res.json({
        isValid: missing.length === 0,
        missingRanges: missing
      });
    } catch (error) {
      res.status(500).json({ error: 'Validation failed' });
    }
  }
);

module.exports = router;
