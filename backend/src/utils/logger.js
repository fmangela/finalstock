// 日志工具模块，基于 winston 封装
// 统一格式：时间戳 + 级别 + 消息，异常时附带堆栈信息
// 日志级别由环境变量 LOG_LEVEL 控制，默认 info
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    // 有堆栈时附加堆栈，方便排查异常
    format.printf(({ timestamp, level, message, stack }) =>
      stack
        ? `${timestamp} [${level.toUpperCase()}] ${message}\n${stack}`
        : `${timestamp} [${level.toUpperCase()}] ${message}`
    )
  ),
  transports: [new transports.Console()]
});

module.exports = logger;
