// models/Assignment.js - Canvas assignment model
module.exports = (sequelize, DataTypes) => {
  const Assignment = sequelize.define('Assignment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    canvasAssignmentId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    courseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'courses',
        key: 'id'
      }
    },
    teacherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    dueAt: {
      type: DataTypes.DATE
    },
    pointsPossible: {
      type: DataTypes.FLOAT
    },
    gradingType: {
      type: DataTypes.STRING,
      defaultValue: 'points'
    },
    // Rubric data
    rubric: {
      type: DataTypes.JSONB
    },
    hasRubric: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Plugin specific: is feedback plugin active for this assignment?
    pluginEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Which template set is used (references Template groups)
    templateSetId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'templates',
        key: 'id'
      }
    },
    // Auto-generation trigger
    autoGenerateOnGrading: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'assignments',
    timestamps: true,
    indexes: [
      { fields: ['canvasAssignmentId'] },
      { fields: ['courseId'] },
      { fields: ['teacherId'] },
      { fields: ['pluginEnabled'] }
    ]
  });

  return Assignment;
};
