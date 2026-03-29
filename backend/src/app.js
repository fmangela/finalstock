// Express 应用配置：中间件、限流、路由注册、全局错误处理
// 与 index.js 分离，便于测试时直接导入 app 而不启动服务器
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

const app = express();

app.use(cors());
app.use(express.json());

// 全局限流：每个 IP 每分钟最多 200 次请求，防止接口滥用
app.use(rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

// 路由注册
app.use('/api/stocks',     require('./routes/stocks'));      // 股票行情
app.use('/api/news',       require('./routes/news'));        // 财经新闻
app.use('/api/prediction', require('./routes/predictions')); // AI 选股
app.use('/api/simulation', require('./routes/simulation'));  // 模拟交易
app.use('/api/analysis',   require('./routes/analysis'));    // 每日指导
app.use('/api/config',     require('./routes/config'));      // 系统配置
app.use('/api/prompts',    require('./routes/prompts'));      // 提示词管理
app.use('/api/llm-config', require('./routes/llmConfig'));   // 大模型配置
app.use('/api/logs',       require('./routes/logs'));        // 应用日志
app.use('/api/backtest',   require('./routes/backtest'));   // 策略回测
app.use('/api/strategy',   require('./routes/strategy'));    // 策略管理
app.use('/api/sim',        require('./routes/sim'));         // 模拟交易（新）
app.use('/api/workflow',   require('./routes/workflow'));    // 自动流程

// 健康检查接口，供运维监控使用
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// 全局错误处理中间件：记录错误日志并返回统一格式
app.use(async (err, req, res, next) => {
  logger.error(`${req.method} ${req.url} - ${err.message}`, err);
  try {
    const { AppLog, SystemConfig } = require('./models');
    // 读取日志开关配置，决定是否写入数据库
    const cfg = await SystemConfig.findOne({ where: { config_group: 'logging', config_key: 'enabled' } });
    if (!cfg || cfg.config_value === '1') {
      await AppLog.error('api', err.message?.slice(0, 500) || 'Unknown error',
        JSON.stringify({ url: req.url, method: req.method, stack: err.stack?.slice(0, 2000) }));
    }
  } catch (logErr) {
    logger.warn(`写入数据库错误日志失败: ${logErr.message}`);
  }
  res.status(500).json({ code: 1, message: err.message || 'Internal server error' });
});

module.exports = app;
