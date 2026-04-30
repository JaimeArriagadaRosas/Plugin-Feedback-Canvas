// models/index.js - Central export of all models
const { sequelize } = require('../config/database');

const User = require('./User')(sequelize);
const Course = require('./Course')(sequelize);
const Assignment = require('./Assignment')(sequelize);
const Template = require('./Template')(sequelize);
const Feedback = require('./Feedback')(sequelize);
const PersonalizationVar = require('./PersonalizationVar')(sequelize);
const CourseAssignmentConfig = require('./CourseAssignmentConfig')(sequelize);
const NotificationLog = require('./NotificationLog')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);
const AIConfig = require('./AIConfig')(sequelize);

// Define associations
User.hasMany(Feedback, { foreignKey: 'studentId', as: 'feedbacksReceived' });
User.belongsToMany(Course, { through: 'Enrollments', foreignKey: 'userId' });
Course.belongsToMany(User, { through: 'Enrollments', foreignKey: 'courseId' });

Course.hasMany(Assignment, { foreignKey: 'courseId' });
Assignment.belongsTo(Course, { foreignKey: 'courseId' });

Assignment.hasMany(CourseAssignmentConfig, { foreignKey: 'assignmentId' });
CourseAssignmentConfig.belongsTo(Assignment, { foreignKey: 'assignmentId' });

User.hasMany(Assignment, { foreignKey: 'teacherId' });
Assignment.belongsTo(User, { foreignKey: 'teacherId' });

User.hasMany(Course, { foreignKey: 'teacherId' });
Course.belongsTo(User, { foreignKey: 'teacherId' });

Template.belongsTo(User, { foreignKey: 'createdBy' });
Template.belongsTo(Course, { foreignKey: 'courseId', as: 'courseTemplate' });

User.hasMany(Template, { foreignKey: 'createdBy' });
Course.hasMany(Template, { foreignKey: 'courseId' });

Feedback.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
Feedback.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
Feedback.belongsTo(Assignment, { foreignKey: 'assignmentId' });
Feedback.hasMany(FeedbackReview, { foreignKey: 'feedbackId' });
FeedbackReview.belongsTo(Feedback, { foreignKey: 'feedbackId' });
FeedbackReview.belongsTo(User, { foreignKey: 'reviewedBy' });

PersonalizationVar.belongsTo(Course, { foreignKey: 'courseId' });
Course.hasMany(PersonalizationVar, { foreignKey: 'courseId' });

CourseAssignmentConfig.belongsTo(Course, { foreignKey: 'courseId' });
CourseAssignmentConfig.belongsTo(Assignment, { foreignKey: 'assignmentId' });
CourseAssignmentConfig.hasMany(Template, { foreignKey: 'configId' });

NotificationLog.belongsTo(User, { foreignKey: 'recipientId' });
NotificationLog.belongsTo(User, { foreignKey: 'senderId' });

AuditLog.belongsTo(User, { foreignKey: 'userId' });

AIConfig.belongsTo(User, { foreignKey: 'updatedBy' });

module.exports = {
  sequelize,
  User,
  Course,
  Assignment,
  Template,
  Feedback,
  FeedbackReview,
  PersonalizationVar,
  CourseAssignmentConfig,
  NotificationLog,
  AuditLog,
  AIConfig
};
