// models/User.js - Canvas user model (professors and students)
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    canvasUserId: {
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
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    role: {
      type: DataTypes.ENUM('admin', 'teacher', 'student'),
      allowNull: false,
      defaultValue: 'student'
    },
    // Canvas LTI specific
    ltiCanvasUserId: {
      type: DataTypes.STRING
    },
    // User preferences
    notificationPreference: {
      type: DataTypes.ENUM('in_app', 'email', 'both'),
      defaultValue: 'in_app'
    },
    language: {
      type: DataTypes.STRING,
      defaultValue: 'es'
    },
    // Last sync with Canvas
    lastSyncAt: {
      type: DataTypes.DATE
    },
    // UUID for plugin identification
    pluginUserId: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      unique: true
    }
  }, {
    tableName: 'users',
    timestamps: true,
    indexes: [
      { fields: ['canvasUserId'] },
      { fields: ['role'] },
      { fields: ['email'] }
    ]
  });

  return User;
};
