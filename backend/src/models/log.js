const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AppLog = sequelize.define('AppLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  level: {
    type: DataTypes.STRING(10),
    defaultValue: 'info',
    validate: { isIn: [['info', 'error', 'warn']] }
  },
  source: {
    type: DataTypes.STRING(50)
  },
  message: {
    type: DataTypes.STRING(500)
  },
  content: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'app_logs',
  timestamps: false,
  createdAt: 'created_at',
  updatedAt: false
});

// 静态方法：记录日志
AppLog.log = async function(level, source, message, content = null) {
  try {
    // 检查是否开启日志
    const { SystemConfig } = require('../models');
    const configs = await SystemConfig.findAll({ where: { config_group: 'logging' } });
    const enabled = configs.find(c => c.config_key === 'enabled')?.config_value === '1';
    
    if (!enabled && level !== 'error') return; // 错误日志始终记录
    
    return await AppLog.create({ level, source, message, content });
  } catch (e) {
    console.error('Failed to write log:', e.message);
  }
};

AppLog.info = function(source, message, content) {
  return AppLog.log('info', source, message, content);
};

AppLog.error = function(source, message, content) {
  return AppLog.log('error', source, message, content);
};

module.exports = AppLog;