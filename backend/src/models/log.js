// 应用日志模型：将关键操作和错误写入数据库，便于在前端日志页面查看
// 提供静态方法 AppLog.info / AppLog.error，受系统配置中的日志开关控制
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
    validate: { isIn: [['info', 'error', 'warn']] }  // 只允许三种级别
  },
  source:  { type: DataTypes.STRING(50) },   // 日志来源模块，如 'api' / 'scheduler'
  message: { type: DataTypes.STRING(500) },  // 简短描述
  content: { type: DataTypes.TEXT }          // 详细内容（如请求参数、堆栈等）
}, {
  tableName: 'app_logs',
  timestamps: false,
  createdAt: 'created_at',
  updatedAt: false
});

// 写入日志（内部方法）
// 错误日志始终写入；info/warn 日志受系统配置 logging.enabled 控制
AppLog.log = async function(level, source, message, content = null) {
  try {
    const { SystemConfig } = require('../models');
    const configs = await SystemConfig.findAll({ where: { config_group: 'logging' } });
    const enabled = configs.find(c => c.config_key === 'enabled')?.config_value === '1';

    if (!enabled && level !== 'error') return; // 日志关闭时只保留错误级别

    return await AppLog.create({ level, source, message, content });
  } catch (e) {
    require('../utils/logger').error('Failed to write log: ' + e.message);
  }
};

// 快捷方法：记录 info 级别日志
AppLog.info = function(source, message, content) {
  return AppLog.log('info', source, message, content);
};

// 快捷方法：记录 error 级别日志
AppLog.error = function(source, message, content) {
  return AppLog.log('error', source, message, content);
};

module.exports = AppLog;
