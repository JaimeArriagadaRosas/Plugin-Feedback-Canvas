// models/Course.js - Canvas course model
module.exports = (sequelize, DataTypes) => {
  const Course = sequelize.define('Course', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    canvasCourseId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    courseCode: {
      type: DataTypes.STRING
    },
    teacherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // Plugin specific settings for this course
    isPluginActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Personalization variables enabled for this course
    personalizationSettings: {
      type: DataTypes.JSONB,
      defaultValue: {
        usePreviousGrades: true,
        useOtherCourses: false,
        useAdmissionProfile: false,
        useAcademicBackground: false,
        weights: {
          previousGrades: 0.6,
          otherCourses: 0.2,
          admissionProfile: 0.1,
          academicBackground: 0.1
        }
      }
    },
    // Plugin configuration
    config: {
      type: DataTypes.JSONB,
      defaultValue: {
        autoGenerateEnabled: true,
        notificationEnabled: true,
        requireApproval: true,
        maxFeedbackLength: 500
      }
    }
  }, {
    tableName: 'courses',
    timestamps: true,
    indexes: [
      { fields: ['canvasCourseId'] },
      { fields: ['teacherId'] },
      { fields: ['isPluginActive'] }
    ]
  });

  return Course;
};
