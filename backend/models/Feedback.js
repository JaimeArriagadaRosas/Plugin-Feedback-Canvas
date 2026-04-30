// models/Feedback.js - Generated feedback instance (RF01, RF07-RF08)
module.exports = (sequelize, DataTypes) => {
  const Feedback = sequelize.define('Feedback', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // Student who receives feedback
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // Teacher who generated/approved
    teacherId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    assignmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'assignments',
        key: 'id'
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
    // Grade at time of generation
    grade: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    // Grade range classification
    gradeRange: {
      type: DataTypes.ENUM('excellent', 'satisfactory', 'needs_improvement'),
      allowNull: false
    },
    // Generated content
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    // Edited content (if professor modified)
    editedContent: {
      type: DataTypes.TEXT
    },
    // AI generation metadata
    aiModelUsed: {
      type: DataTypes.STRING
    },
    tokensUsed: {
      type: DataTypes.INTEGER
    },
    generationTimeMs: {
      type: DataTypes.INTEGER
    },
    promptUsed: {
      type: DataTypes.TEXT
    },
    // Student context used for generation
    studentContext: {
      type: DataTypes.JSONB
    },
    // Personalization variables applied
    personalizationVariables: {
      type: DataTypes.JSONB
    },
    // Template used
    templateId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'templates',
        key: 'id'
      }
    },
    // Status
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'edited', 'rejected', 'sent'),
      defaultValue: 'pending'
    },
    // Professor's quality rating (1-5 stars) - RF08
    qualityRating: {
      type: DataTypes.INTEGER,
      min: 1,
      max: 5
    },
    // Student utility rating (RF33)
    studentUtilityRating: {
      type: DataTypes.INTEGER,
      min: 1,
      max: 5
    },
    studentUtilityFeedback: {
      type: DataTypes.TEXT
    },
    // Sent timestamp (when approved and sent to Canvas)
    sentAt: {
      type: DataTypes.DATE
    },
    // Canvas comment ID (for reference)
    canvasCommentId: {
      type: DataTypes.STRING
    },
    // Private notes from professor (RF29)
    privateNotes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'feedbacks',
    timestamps: true,
    indexes: [
      { fields: ['studentId'] },
      { fields: ['assignmentId'] },
      { fields: ['courseId'] },
      { fields: ['teacherId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] },
      { fields: ['gradeRange'] }
    ]
  });

  return Feedback;
};
