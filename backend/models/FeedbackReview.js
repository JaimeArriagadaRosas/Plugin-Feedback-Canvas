// models/FeedbackReview.js - Professor review/approval tracking
module.exports = (sequelize, DataTypes) => {
  const FeedbackReview = sequelize.define('FeedbackReview', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    feedbackId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'feedbacks',
        key: 'id'
      }
    },
    // Who reviewed
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // Action taken
    action: {
      type: DataTypes.ENUM('viewed', 'edited', 'approved', 'rejected', 'regenerated'),
      allowNull: false
    },
    // Previous content snapshot (for audit)
    previousContent: {
      type: DataTypes.TEXT
    },
    newContent: {
      type: DataTypes.TEXT
    },
    // Reason for rejection/regeneration
    reason: {
      type: DataTypes.TEXT
    },
    // Timestamp
    reviewedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'feedback_reviews',
    timestamps: true,
    indexes: [
      { fields: ['feedbackId'] },
      { fields: ['reviewedBy'] },
      { fields: ['action'] },
      { fields: ['reviewedAt'] }
    ]
  });

  return FeedbackReview;
};
