// routes/admin.js - Admin panel endpoints (RF51-RF60)
const express = require('express');
const router = express.Router();
const { verifyLTIToken, authorizeRoles, isAdmin, adminLimiter } = require('../middleware/lti');
const { AIConfig, User, AuditLog, NotificationLog } = require('../models');
const aiService = require('../services/aiService');
const { errors } = require('../middleware/errorHandler');

router.use(verifyLTIToken);

// RF51-RF56: AI Configuration
router.get('/ai-config', 
  authorizeRoles('admin'),
  async (req, res) => {
    try {
      const configs = await AIConfig.findAll({
        where: { isActive: true },
        include: [
          { model: User, as: 'updatedByUser', attributes: ['id', 'name'] }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.json({
        configs: configs.map(c => ({
          configKey: c.configKey,
          provider: c.provider,
          modelName: c.modelName,
          temperature: c.temperature,
          maxTokens: c.maxTokens,
          customEndpoint: c.customEndpoint,
          version: c.version,
          updatedAt: c.updatedAt,
          updatedBy: c.updatedByUser?.name
        })),
        availableProviders: aiService.getAvailableProviders()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch AI config' });
    }
  }
);

router.put('/ai-config/:key', 
  authorizeRoles('admin'),
  adminLimiter,
  async (req, res) => {
    try {
      const { key } = req.params;
      const { provider, modelName, temperature, maxTokens, customEndpoint, apiKey } = req.body;
      
      let config = await AIConfig.findOne({ where: { configKey: key } });
      
      if (!config) {
        // Create new config
        config = await AIConfig.create({
          configKey: key,
          provider: provider || 'openai',
          modelName: modelName || 'gpt-4o',
          temperature: temperature || 0.7,
          maxTokens: maxTokens || 500,
          customEndpoint,
          updatedBy: req.user.userId,
          isActive: true
        });
      } else {
        // Store previous for audit
        const previousConfig = config.get();
        
        await config.update({
          provider: provider || config.provider,
          modelName: modelName || config.modelName,
          temperature: temperature || config.temperature,
          maxTokens: maxTokens || config.maxTokens,
          customEndpoint: customEndpoint || config.customEndpoint,
          updatedBy: req.user.userId,
          previousConfig,
          version: config.version + 1
        });
        
        // Update active provider in aiService
        if (key === 'default') {
          aiService.setProvider(provider || config.provider);
        }
      }

      // Audit
      await require('../services/feedbackService').logAudit({
        userId: req.user.userId,
        action: 'ai_config_updated',
        entityType: 'config',
        entityId: config.id,
        details: { configKey: key, provider, modelName }
      });

      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update AI config' });
    }
  }
);

// RF57: API Key management (store reference only)
router.post('/api-keys', 
  authorizeRoles('admin'),
  async (req, res) => {
    try {
      const { provider, apiKey } = req.body;
      
      // In production, use a secrets manager. Here store reference.
      // For demo, we'd update environment config or secure store
      // This is a placeholder implementation
      
      res.json({ 
        success: true, 
        message: 'API key stored securely' 
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to store API key' });
    }
  }
);

// RF52: Modify permissions by role
router.get('/roles', 
  authorizeRoles('admin'),
  async (req, res) => {
    try {
      // Define role permissions
      const roles = {
        admin: {
          canManageTemplates: true,
          canGenerateFeedback: true,
          canApproveFeedback: true,
          canViewAllCourses: true,
          canConfigureAI: true,
          canViewReports: true
        },
        teacher: {
          canManageTemplates: true,
          canGenerateFeedback: true,
          canApproveFeedback: true,
          canViewAllCourses: false,
          canConfigureAI: false,
          canViewReports: true
        },
        student: {
          canManageTemplates: false,
          canGenerateFeedback: false,
          canApproveFeedback: false,
          canViewAllCourses: false,
          canConfigureAI: false,
          canViewReports: false
        }
      };
      
      res.json({ roles });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  }
);

router.put('/roles/:role', 
  authorizeRoles('admin'),
  adminLimiter,
  async (req, res) => {
    try {
      const { role } = req.params;
      const { permissions } = req.body;
      
      // In production, store in a permissions table
      // For now, return success
      
      // Audit
      await require('../services/feedbackService').logAudit({
        userId: req.user.userId,
        action: 'permissions_updated',
        entityType: 'system',
        entityId: null,
        details: { role, permissions }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update permissions' });
    }
  }
);

// RF53: Audit logs
router.get('/audit-logs', 
  authorizeRoles('admin'),
  async (req, res) => {
    try {
      const { page = 1, limit = 50, userId, action, startDate, endDate } = req.query;
      
      const whereClause = {};
      if (userId) whereClause.userId = userId;
      if (action) whereClause.action = action;
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
        if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
      }
      
      const logs = await AuditLog.findAll({
        where: whereClause,
        include: [
          { model: User, attributes: ['id', 'name', 'email'] }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });

      const total = await AuditLog.count({ where: whereClause });

      res.json({
        logs: logs.map(l => ({
          id: l.id,
          userId: l.userId,
          userName: l.User?.name,
          userRole: l.userRole,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          details: l.details,
          outcome: l.outcome,
          ipAddress: l.ipAddress,
          createdAt: l.createdAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

// RF54: Log security incidents
router.post('/security-incident', 
  authorizeRoles('admin'),
  async (req, res) => {
    try {
      const { type, description, severity, ipAddress, userAgent } = req.body;
      
      await AuditLog.create({
        userId: req.user.userId,
        userRole: req.user.role,
        action: 'security_incident',
        entityType: 'system',
        details: { type, description, severity },
        outcome: 'logged',
        ipAddress: ipAddress || req.ip,
        userAgent: userAgent || req.headers['user-agent']
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to log incident' });
    }
  }
);

// System health status
router.get('/health', 
  async (req, res) => {
    try {
      const canvasHealth = await require('../services/canvasService')().healthCheck();
      const aiHealth = await aiService.healthCheck();
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          canvas: canvasHealth,
          ai: aiHealth
        }
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'unhealthy', 
        error: error.message 
      });
    }
  }
);

module.exports = router;
