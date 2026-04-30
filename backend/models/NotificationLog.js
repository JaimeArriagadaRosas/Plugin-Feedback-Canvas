// models/NotificationLog.js - Notification tracking (RF44)
module.exports = (sequelize, DataTypes) => {
  const NotificationLog = sequelize.define('NotificationLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // Recipient (student)
    recipientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // Sender (usually teacher or system)
    senderId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    feedbackId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'feedbacks',
        key: 'id'
      }
    },
    // Notification content
    subject: {
      type: DataTypes.STRING
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    // Channel used
    channel: {
      type: DataTypes.ENUM('in_app', 'email', 'both'),
      allowNull: false
    },
    // Canvas message ID (if sent via Canvas)
    canvasMessageId: {
      type: DataTypes.STRING
    },
    // Delivery status
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'delivered', 'failed', 'read'),
      defaultValue: 'pending'
    },
    // Error if failed
    errorMessage: {
      type: DataTypes.TEXT
    },
    // Timestamps
    sentAt: {
      type: DataTypes.DATE
    },
    deliveredAt: {
      type: DataTypes.DATE
    },
    readAt: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'notification_logs',
    timestamps: true,
    indexes: [
      { fields: ['recipientId'] },
      { fields: ['senderId'] },
      { fields: ['feedbackId'] },
      { fields: ['status'] },
      { fields: ['sentAt'] }
    ]
  });

  return NotificationLog;
};
