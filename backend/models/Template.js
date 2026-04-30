// models/Template.js - Feedback template model (RF09-RF15)
module.exports = (sequelize, DataTypes) => {
  const Template = sequelize.define('Template', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT
    },
    // Course this template belongs to (null = global)
    courseId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'courses',
        key: 'id'
      }
    },
    // Owner/creator
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // Grade range
    gradeRange: {
      type: DataTypes.ENUM('excellent', 'satisfactory', 'needs_improvement'),
      allowNull: false
    },
    minGrade: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    maxGrade: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    // Template content with variable placeholders
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    // Variables used in this template
    variables: {
      type: DataTypes.JSONB,
      defaultValue: ['nombre_estudiante', 'calificacion', 'promedio_curso']
    },
    // Status
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Usage tracking
    usageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastUsedAt: {
      type: DataTypes.DATE
    },
    // Metadata
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    // Soft delete tracking
    deletedAt: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'templates',
    timestamps: true,
    paranoid: true, // soft delete
    indexes: [
      { fields: ['courseId'] },
      { fields: ['createdBy'] },
      { fields: ['gradeRange'] },
      { fields: ['isActive'] },
      { fields: ['deletedAt'] }
    ]
  });

  return Template;
};
