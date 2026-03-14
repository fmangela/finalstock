// 应用入口：连接数据库后启动定时任务和 HTTP 服务
require('dotenv').config();
const sequelize = require('./config/database');
const logger = require('./utils/logger');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const scheduler = require('./services/scheduler');

sequelize.authenticate()
  .then(() => {
    logger.info('Database connected');
    scheduler.start();   // 启动定时任务（新闻同步、选股状态检查等）
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch(err => {
    logger.error('Database connection failed:', err);
    process.exit(1);
  });
