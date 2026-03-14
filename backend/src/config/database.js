// 数据库连接配置（Sequelize + MySQL/MariaDB）
// 所有连接参数均从环境变量读取，支持连接池复用
require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'openclaw',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    // 开发环境打印 SQL 语句，生产环境关闭
    logging: process.env.NODE_ENV === 'development' ? (msg) => require('../utils/logger').debug(msg) : false,
    pool: {
      max: 10,      // 最大连接数
      min: 0,       // 最小连接数
      acquire: 30000, // 获取连接超时（毫秒）
      idle: 10000   // 连接空闲超时（毫秒）
    }
  }
);

module.exports = sequelize;
