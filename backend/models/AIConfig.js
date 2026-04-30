// models/AIConfig.js - AI engine configuration (RF54, RF55)
module.exports = (sequelize, DataTypes) => {
  const AIConfig = sequelize.define('AIConfig', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // Config name/key
    configKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    // Current provider
    provider: {
      type: DataTypes.ENUM('openai', 'anthropic', 'gemini', 'mock'),
      allowNull: false,
      defaultValue: 'openai'
    },
    // Model being used
    modelName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // API credentials (stored encrypted ideally, here as reference)
    apiKeyReference: {
      type: DataTypes.STRING,
      comment: 'Reference to secure vault, not actual key'
    },
    // Generation parameters
    temperature: {
      type: DataTypes.FLOAT,
      defaultValue: 0.7,
      validate: {
        min: 0,
        max: 2
      }
    },
    maxTokens: {
      type: DataTypes.INTEGER,
      defaultValue: 500
    },
    topP: {
      type: DataTypes.FLOAT,
      defaultValue: 1.0
    },
    frequencyPenalty: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    presencePenalty: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    // Endpoint override (for custom deployments)
    customEndpoint: {
      type: DataTypes.STRING
    },
    // Who last updated
    updatedBy: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // Is this the active config?
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Version for rollback
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    // History
    previousConfig: {
      type: DataTypes.JSONB
    }
  }, {
    tableName: 'ai_configs',
    timestamps: true,
    indexes: [
      { fields: ['configKey'] },
      { fields: ['isActive'] }
    ]
  });

  return AIConfig;
};
