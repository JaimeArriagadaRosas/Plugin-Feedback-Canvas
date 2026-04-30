// models/AuditLog.js - Security audit log (RF53-RF54)
module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    userRole: {
      type: DataTypes.ENUM('admin', 'teacher', 'student', 'system'),
      allowNull: false
    },
    // Action performed
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Entity affected
    entityType: {
      type: DataTypes.ENUM('feedback', 'template', 'course', 'assignment', 'user', 'config', 'system'),
      allowNull: false
    },
    entityId: {
      type: DataTypes.INTEGER
    },
    // Details of the action
    details: {
      type: DataTypes.JSONB
    },
    // Request metadata
    ipAddress: {
      type: DataTypes.STRING
    },
    userAgent: {
      type: DataTypes.STRING
    },
    // Canvas context
    canvasUserId: {
      type: DataTypes.STRING
    },
    canvasCourseId: {
      type: DataTypes.STRING
    },
    canvasAssignmentId: {
      type: DataTypes.STRING
    },
    // Outcome
    outcome: {
      type: DataTypes.ENUM('success', 'failure', 'error'),
      defaultValue: 'success'
    },
    errorMessage: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['action'] },
      { fields: ['entityType'] },
      { fields: ['entityId'] },
      { fields: ['outcome'] },
      { fields: ['createdAt'] }
    ]
  });

  return AuditLog;
};
