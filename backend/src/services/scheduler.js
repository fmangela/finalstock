// 定时任务调度器
// 负责三类后台任务：
//   1. 定时同步财经新闻（周期可在系统配置中动态调整）
//   2. 每天凌晨清理过期新闻
//   3. 每小时检查并更新选股记录的过期状态
const cron = require('node-cron');
const { Op } = require('sequelize');
const DataService = require('./DataService');
const { StockNews, SystemConfig } = require('../models');
const logger = require('../utils/logger');

// 当前运行的新闻同步任务句柄，用于动态停止/重启
let newsSyncTask = null;

// 从数据源拉取最新新闻并去重写入数据库
async function updateNews() {
  logger.info('[Scheduler] 开始更新新闻...');
  try {
    const news = await fetchNewsFromEnabledSources();
    let created = 0;
    for (const item of news) {
      const [, isNew] = await StockNews.findOrCreate({
        where: { title: item.title },
        defaults: {
          content: item.content,
          source: item.source,
          pub_date: item.pub_date || new Date(),
          sentiment_score: 0,
          importance: 1
        }
      });
      if (isNew) created++;
    }
    logger.info(`[Scheduler] 新闻更新完成，新增 ${created} 条，共获取 ${news.length} 条`);
  } catch (e) {
    logger.error(`[Scheduler] 新闻更新失败: ${e.message}`);
  }
}

// 读取系统配置中勾选的新闻源，并发拉取后合并去重
async function fetchNewsFromEnabledSources(pageSize = 50) {
  const config = await SystemConfig.findOne({
    where: { config_group: 'news', config_key: 'sources' }
  });
  let sources = ['eastmoney'];
  if (config?.config_value) {
    try { sources = JSON.parse(config.config_value); } catch {}
  }

  const providers = require('./providers/AKShareNewsProvider');
  const results = await Promise.allSettled(
    sources.map(s => providers[s]?.getNews(1, pageSize) ?? Promise.resolve([]))
  );

  const seen = new Set();
  const merged = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const item of r.value) {
      if (item.title && !seen.has(item.title)) {
        seen.add(item.title);
        merged.push(item);
      }
    }
  }
  return merged;
}

// 删除超过保留天数的旧新闻，保留天数从系统配置读取，默认 7 天
async function cleanOldNews() {
  logger.info('[Scheduler] 开始清理旧新闻...');
  try {
    const config = await SystemConfig.findOne({
      where: { config_group: 'news', config_key: 'retention_days' }
    });
    const retentionDays = config ? parseInt(config.config_value) : 7;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await StockNews.destroy({
      where: { created_at: { [Op.lt]: cutoffDate } }
    });

    logger.info(`[Scheduler] 新闻清理完成，删除 ${result} 条超过 ${retentionDays} 天的旧新闻`);
  } catch (e) {
    logger.error(`[Scheduler] 新闻清理失败: ${e.message}`);
  }
}

// 根据周期类型和数值构建 cron 表达式
// 例：periodType='hour', periodValue='6' → '0 */6 * * *'
function buildCronExpr(periodType, periodValue) {
  const v = parseInt(periodValue) || 1;
  switch (periodType) {
    case 'second': return `*/${v} * * * * *`;
    case 'minute': return `*/${v} * * * *`;
    case 'hour':   return `0 */${v} * * *`;
    case 'day':    return `0 0 */${v} * *`;
    case 'week':   return `0 0 * * ${(v - 1) % 7}`;
    case 'month':  return `0 0 1 */${v} *`;
    case 'year':   return `0 0 1 1 *`;
    default:       return `0 */6 * * *`;  // 兜底：每 6 小时
  }
}

// 从系统配置表读取新闻同步参数，动态启动或重启调度任务
// 支持在前端设置页面修改同步频率后立即生效
async function reloadNewsSyncSchedule() {
  try {
    const configs = await SystemConfig.findAll({
      where: { config_group: 'news', config_key: ['sync_enabled', 'sync_period_type', 'sync_period_value', 'sync_start_time', 'sync_end_time', 'sync_cron_expr'] }
    });
    const cfg = {};
    for (const c of configs) cfg[c.config_key] = c.config_value;

    const enabled = cfg.sync_enabled === '1';
    const endTime = parseInt(cfg.sync_end_time) || 0;

    // 先停止旧任务，再按新配置重建
    if (newsSyncTask) {
      newsSyncTask.stop();
      newsSyncTask = null;
      logger.info('[Scheduler] 已停止旧的新闻同步任务');
    }

    if (!enabled) {
      logger.info('[Scheduler] 新闻同步已禁用，不启动调度任务');
      return;
    }

    // 检查终止时间（时间戳），已过期则不启动
    if (endTime > 0 && Date.now() > endTime) {
      logger.info('[Scheduler] 新闻同步终止时间已过，不启动调度任务');
      return;
    }

    const periodType = cfg.sync_period_type || 'hour';
    const periodValue = cfg.sync_period_value || '6';
    const cronExpr = buildCronExpr(periodType, periodValue);

    // 将生成的 cron 表达式回写到配置表，方便前端展示
    await SystemConfig.upsert({ config_group: 'news', config_key: 'sync_cron_expr', config_value: cronExpr });

    const useSeconds = periodType === 'second';
    newsSyncTask = cron.schedule(cronExpr, async () => {
      // 每次执行前再次检查终止时间，支持运行中自动停止
      const endCfg = await SystemConfig.findOne({ where: { config_group: 'news', config_key: 'sync_end_time' } });
      const currentEnd = parseInt(endCfg?.config_value) || 0;
      if (currentEnd > 0 && Date.now() > currentEnd) {
        logger.info('[Scheduler] 新闻同步已到终止时间，自动停止');
        newsSyncTask.stop();
        newsSyncTask = null;
        await SystemConfig.upsert({ config_group: 'news', config_key: 'sync_enabled', config_value: '0' });
        return;
      }
      await updateNews();
    }, { scheduled: true, ...(useSeconds ? { timezone: undefined } : {}) });

    logger.info(`[Scheduler] 新闻同步已启动，周期: ${periodType}/${periodValue}，cron: ${cronExpr}`);
  } catch (e) {
    logger.error(`[Scheduler] 加载新闻同步配置失败: ${e.message}`);
  }
}

// 启动所有定时任务，在服务器启动时调用一次
function start() {
  // 启动时立即执行一次新闻同步，不等待第一个 cron 触发
  updateNews();

  // 加载动态调度配置；若配置未启用则回退到默认每 6 小时
  reloadNewsSyncSchedule().then(() => {
    if (!newsSyncTask) {
      cron.schedule('0 */6 * * *', updateNews);
      logger.info('[Scheduler] 使用默认调度：每6小时更新新闻');
    }
  });

  // 每天凌晨 3 点清理过期新闻
  cron.schedule('0 3 * * *', cleanOldNews);
  logger.info('[Scheduler] 新闻定时清理已启动，每天凌晨3点执行');

  // 每小时检查选股记录是否超过观测周期
  cron.schedule('0 * * * *', checkExpiredPredictions);
  logger.info('[Scheduler] 选股状态检查已启动，每小时执行');

  // 模拟交易：盘前 9:25 推进（pre_open 任务）
  cron.schedule('25 9 * * 1-5', () => runSimTasks('pre_open'));
  // 模拟交易：收盘前 14:55 推进（pre_close 任务）
  cron.schedule('55 14 * * 1-5', () => runSimTasks('pre_close'));
  logger.info('[Scheduler] 模拟交易定时任务已启动（9:25 盘前 / 14:55 收盘前）');
}

// 检查并更新过期选股记录的状态
// 规则：超过观测周期 → 标记 expired；超过 2 倍周期 → 直接删除
async function checkExpiredPredictions() {
  logger.info('[Scheduler] 开始检查选股状态...');
  try {
    const { StockPrediction } = require('../models');
    const now = new Date();

    const activePredictions = await StockPrediction.findAll({
      where: { status: 'active' }
    });

    let expiredCount = 0;
    let deletedCount = 0;

    for (const pred of activePredictions) {
      const stockupDate = new Date(pred.stockup_date);
      const diffDays = (now - stockupDate) / (1000 * 60 * 60 * 24);

      // 观测周期天数映射
      const periodDays = { '一周': 7, '一月': 30, '一年': 365 };
      const threshold = periodDays[pred.observation_period || '一月'] || 30;

      if (diffDays > threshold * 2) {
        // 超过 2 倍周期，自动删除
        await pred.destroy();
        deletedCount++;
      } else if (diffDays > threshold) {
        // 超过观测周期，标记为过期
        await pred.update({ status: 'expired' });
        expiredCount++;
      }
    }

    logger.info(`[Scheduler] 选股状态检查完成：过期 ${expiredCount} 条，删除 ${deletedCount} 条`);
  } catch (e) {
    logger.error(`[Scheduler] 选股状态检查失败: ${e.message}`);
  }
}

// 按交易时机推进模拟交易任务
async function runSimTasks(timing) {
  logger.info(`[Scheduler] 开始推进模拟交易任务 timing=${timing}`);
  try {
    const { SimTask } = require('../models');
    const simEngine = require('./simEngine');
    const tasks = await SimTask.findAll({
      where: { status: 'running', trade_timing: timing }
    });
    logger.info(`[Scheduler] 找到 ${tasks.length} 个 ${timing} 任务`);
    for (const task of tasks) {
      try {
        const r = await simEngine.advanceTask(task);
        logger.info(`[Scheduler] 任务 ${task.id} (${task.stock_code}) 推进结果: ${r.action || r.reason}`);
      } catch (e) {
        logger.error(`[Scheduler] 任务 ${task.id} 推进失败: ${e.message}`);
      }
    }
  } catch (e) {
    logger.error(`[Scheduler] 模拟交易推进失败: ${e.message}`);
  }
}

module.exports = { start, reloadNewsSyncSchedule, buildCronExpr };
