const cron = require('node-cron');
const { Op } = require('sequelize');
const DataService = require('./DataService');
const { StockNews, SystemConfig } = require('../models');

let newsSyncTask = null;

async function updateNews() {
  console.log(`[Scheduler] 开始更新新闻... ${new Date().toLocaleString()}`);
  try {
    const news = await DataService.getNews(1, 50);
    let created = 0;
    for (const item of news) {
      const [, isNew] = await StockNews.findOrCreate({
        where: { title: item.title },
        defaults: {
          content: item.content,
          source: item.source,
          pub_date: item.pub_date,
          sentiment_score: 0,
          importance: 1
        }
      });
      if (isNew) created++;
    }
    console.log(`[Scheduler] 新闻更新完成，新增 ${created} 条，共获取 ${news.length} 条`);
  } catch (e) {
    console.error(`[Scheduler] 新闻更新失败: ${e.message}`);
  }
}

async function cleanOldNews() {
  console.log(`[Scheduler] 开始清理旧新闻... ${new Date().toLocaleString()}`);
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

    console.log(`[Scheduler] 新闻清理完成，删除 ${result} 条超过 ${retentionDays} 天的旧新闻`);
  } catch (e) {
    console.error(`[Scheduler] 新闻清理失败: ${e.message}`);
  }
}

// 根据周期类型和数值构建 cron 表达式
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
    default:       return `0 */6 * * *`;
  }
}

// 从配置表读取新闻同步配置并启动/重启调度任务
async function reloadNewsSyncSchedule() {
  try {
    const configs = await SystemConfig.findAll({
      where: { config_group: 'news', config_key: ['sync_enabled', 'sync_period_type', 'sync_period_value', 'sync_start_time', 'sync_end_time', 'sync_cron_expr'] }
    });
    const cfg = {};
    for (const c of configs) cfg[c.config_key] = c.config_value;

    const enabled = cfg.sync_enabled === '1';
    const endTime = parseInt(cfg.sync_end_time) || 0;

    // 停止旧任务
    if (newsSyncTask) {
      newsSyncTask.stop();
      newsSyncTask = null;
      console.log('[Scheduler] 已停止旧的新闻同步任务');
    }

    if (!enabled) {
      console.log('[Scheduler] 新闻同步已禁用，不启动调度任务');
      return;
    }

    // 检查终止时间
    if (endTime > 0 && Date.now() > endTime) {
      console.log('[Scheduler] 新闻同步终止时间已过，不启动调度任务');
      return;
    }

    const periodType = cfg.sync_period_type || 'hour';
    const periodValue = cfg.sync_period_value || '6';
    const cronExpr = buildCronExpr(periodType, periodValue);

    // 保存生成的 cron 表达式
    await SystemConfig.upsert({ config_group: 'news', config_key: 'sync_cron_expr', config_value: cronExpr });

    const useSeconds = periodType === 'second';
    newsSyncTask = cron.schedule(cronExpr, async () => {
      // 运行时再次检查终止时间
      const endCfg = await SystemConfig.findOne({ where: { config_group: 'news', config_key: 'sync_end_time' } });
      const currentEnd = parseInt(endCfg?.config_value) || 0;
      if (currentEnd > 0 && Date.now() > currentEnd) {
        console.log('[Scheduler] 新闻同步已到终止时间，自动停止');
        newsSyncTask.stop();
        newsSyncTask = null;
        await SystemConfig.upsert({ config_group: 'news', config_key: 'sync_enabled', config_value: '0' });
        return;
      }
      await updateNews();
    }, { scheduled: true, ...(useSeconds ? { timezone: undefined } : {}) });

    console.log(`[Scheduler] 新闻同步已启动，周期: ${periodType}/${periodValue}，cron: ${cronExpr}`);
  } catch (e) {
    console.error(`[Scheduler] 加载新闻同步配置失败: ${e.message}`);
  }
}

function start() {
  // 启动时立即执行一次
  updateNews();

  // 加载动态调度配置（若未配置则沿用默认6小时）
  reloadNewsSyncSchedule().then(() => {
    // 若动态调度未启用，保持原有默认6小时任务
    if (!newsSyncTask) {
      cron.schedule('0 */6 * * *', updateNews);
      console.log('[Scheduler] 使用默认调度：每6小时更新新闻');
    }
  });

  // 每天凌晨3点清理旧新闻
  cron.schedule('0 3 * * *', cleanOldNews);
  console.log('[Scheduler] 新闻定时清理已启动，每天凌晨3点执行');
}

module.exports = { start, reloadNewsSyncSchedule, buildCronExpr };
