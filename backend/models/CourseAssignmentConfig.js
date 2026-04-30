// models/CourseAssignmentConfig.js - Plugin configuration per course+assignment (RF38-RF40)
module.exports = (sequelize, DataTypes) => {
  const CourseAssignmentConfig = sequelize.define('CourseAssignmentConfig', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    courseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'courses',
        key: 'id'
      }
    },
    assignmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true, // one config per assignment
      references: {
        model: 'assignments',
        key: 'id'
      }
    },
    // Is plugin active for this assignment?
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Auto-generate on grade entry
    autoGenerateEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Require manual approval before sending to student
    requireApproval: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Associated template set (group of templates by grade range)
    templateSetId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'templates',
        key: 'id'
      }
    },
    // Personalization variable overrides for this assignment
    personalizationOverrides: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    // Notification settings
    notifyStudentOnSend: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notifyTeacherOnPending: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Additional configuration
    config: {
      type: DataTypes.JSONB,
      defaultValue: {
        maxFeedbackLength: 500,
        includeHistoricalComparison: true,
        includeCourseAverage: true,
        tone: 'professional' // professional, supportive, motivational
      }
    }
  }, {
    tableName: 'course_assignment_configs',
    timestamps: true,
    indexes: [
      { fields: ['courseId'] },
      { fields: ['assignmentId'] },
      { fields: ['isActive'] }
    ]
  });

  return CourseAssignmentConfig;
};
