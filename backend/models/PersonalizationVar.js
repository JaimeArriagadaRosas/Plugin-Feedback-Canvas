// models/PersonalizationVar.js - Personalization variables config per course (RF34-RF37)
module.exports = (sequelize, DataTypes) => {
  const PersonalizationVar = sequelize.define('PersonalizationVar', {
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
    // Variable name/type
    variableName: {
      type: DataTypes.ENUM(
        'previous_grades_same_course',
        'performance_other_courses',
        'admission_profile',
        'academic_background',
        'attendance_rate',
        'participation_score'
      ),
      allowNull: false
    },
    // Human-readable label
    label: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Description
    description: {
      type: DataTypes.TEXT
    },
    // Is this variable enabled?
    isEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Weight (0-100, must sum to 100 with other active vars)
    weight: {
      type: DataTypes.FLOAT,
      defaultValue: 25,
      validate: {
        min: 0,
        max: 100
      }
    },
    // Order for display
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'personalization_variables',
    timestamps: true,
    indexes: [
      { fields: ['courseId'] },
      { fields: ['variableName'] },
      { fields: ['isEnabled'] }
    ]
  });

  return PersonalizationVar;
};
