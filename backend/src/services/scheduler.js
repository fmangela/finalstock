// 定时任务调度器
// 负责三类后台任务：
//   1. 定时同步财经新闻（周期可在系统配置中动态调整）
//   2. 每天凌晨清理过期新闻
//   3. 每小时检查并更新选股记录的过期状态
const cron = require('node-cron');
const { Op } = require('sequelize');
const { StockNews, SystemConfig } = require('../models');
const logger = require('../utils/logger');
const { isTodayTradingDay } = require('./tradingCalendar');

function createTaskInfo(name, cronExpr, desc, type) {
  return {
    name,
    cron: cronExpr,
    desc,
    type,
    handle: null,
    active: false,
    status: 'idle',
    statusText: '未启动',
    lastRunAt: null,
    lastResult: '-',
    lastError: null
  };
}

const fixedTasks = {
  cleanNews: createTaskInfo('新闻定时清理', '0 3 * * *', '每天凌晨3点清理过期新闻', 'fixed'),
  checkPredictions: createTaskInfo('选股状态检查', '0 * * * *', '每小时检查选股记录是否超过观测周期', 'fixed'),
  simPreOpen: createTaskInfo('模拟交易 盘前推进', '25 9 * * *', '每个交易日 9:25 推进 pre_open 任务，非交易日自动跳过', 'fixed'),
  simPreClose: createTaskInfo('模拟交易 收盘前推进', '55 14 * * *', '每个交易日 14:55 推进 pre_close 任务，非交易日自动跳过', 'fixed')
};

const newsSyncTask = createTaskInfo('新闻定时同步', '-', '按配置周期同步财经新闻', 'dynamic');
let autoWorkflowTasks = [];

function setTaskStatus(taskInfo, status, statusText) {
  taskInfo.status = status;
  taskInfo.statusText = statusText;
}

function setTaskResult(taskInfo, result = {}) {
  taskInfo.lastRunAt = new Date().toISOString();
  taskInfo.lastResult = result.message || '执行成功';
  taskInfo.lastError = null;
}

function setTaskError(taskInfo, error) {
  taskInfo.lastRunAt = new Date().toISOString();
  taskInfo.lastResult = '执行失败';
  taskInfo.lastError = error.message;
}

function stopTask(taskInfo, status = 'stopped', statusText = '已停止') {
  if (!taskInfo?.handle) return;
  try {
    taskInfo.handle.stop();
  } catch (e) {
    logger.warn(`[Scheduler] 停止任务 ${taskInfo.name} 失败: ${e.message}`);
  }
  taskInfo.handle = null;
  taskInfo.active = false;
  setTaskStatus(taskInfo, status, statusText);
}

function scheduleTrackedTask(taskInfo, cronExpr, handler, options = {}) {
  if (taskInfo.handle) {
    stopTask(taskInfo);
  }
  taskInfo.cron = cronExpr;
  taskInfo.handle = cron.schedule(cronExpr, async () => {
    setTaskStatus(taskInfo, 'running', '执行中');
    try {
      const result = await handler();
      setTaskResult(taskInfo, result);
    } catch (e) {
      setTaskError(taskInfo, e);
      logger.error(`[Scheduler] 任务 ${taskInfo.name} 执行失败: ${e.message}`);
    } finally {
      if (taskInfo.handle) {
        setTaskStatus(taskInfo, 'scheduled', '已调度');
      }
    }
  }, options);
  taskInfo.active = true;
  setTaskStatus(taskInfo, 'scheduled', '已调度');
  return taskInfo.handle;
}

function getTaskSnapshot(taskInfo) {
  return {
    name: taskInfo.name,
    cron: taskInfo.cron,
    desc: taskInfo.desc,
    type: taskInfo.type,
    active: taskInfo.active && !!taskInfo.handle,
    status: taskInfo.status,
    statusText: taskInfo.statusText,
    lastRunAt: taskInfo.lastRunAt,
    lastResult: taskInfo.lastError ? `${taskInfo.lastResult}: ${taskInfo.lastError}` : taskInfo.lastResult
  };
}

// 从数据源拉取最新新闻并去重写入数据库
async function updateNews() {
  logger.info('[Scheduler] 开始更新新闻...');
  const news = await fetchNewsFromEnabledSources();
  let created = 0;
  for (const item of news) {
    const [, isNew] = await StockNews.findOrCreate({
      where: { title: item.title },
      defaults: {
        content: item.content,
        source: item.source,
        source_url: item.source_url || null,
        pub_date: item.pub_date || new Date(),
        sentiment_score: 0,
        importance: 1
      }
    });
    if (isNew) created++;
  }
  const message = `新闻更新完成，新增 ${created} 条，共获取 ${news.length} 条`;
  logger.info(`[Scheduler] ${message}`);
  return { message, created, total: news.length };
}

// 读取系统配置中勾选的新闻源，并发拉取后合并去重
async function fetchNewsFromEnabledSources(pageSize = 50) {
  const config = await SystemConfig.findOne({
    where: { config_group: 'news', config_key: 'sources' }
  });
  let sources = ['eastmoney'];
  if (config?.config_value) {
    try {
      sources = JSON.parse(config.config_value);
    } catch (e) {
      logger.warn(`[Scheduler] 解析新闻源配置失败，回退默认值: ${e.message}`);
    }
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
  const config = await SystemConfig.findOne({
    where: { config_group: 'news', config_key: 'retention_days' }
  });
  const retentionDays = config ? parseInt(config.config_value) : 7;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await StockNews.destroy({
    where: { created_at: { [Op.lt]: cutoffDate } }
  });

  const message = `新闻清理完成，删除 ${result} 条超过 ${retentionDays} 天的旧新闻`;
  logger.info(`[Scheduler] ${message}`);
  return { message, deleted: result, retentionDays };
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
    default:       return '0 */6 * * *';
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

    if (newsSyncTask.handle) {
      stopTask(newsSyncTask);
      logger.info('[Scheduler] 已停止旧的新闻同步任务');
    }

    if (!enabled) {
      newsSyncTask.cron = '-';
      newsSyncTask.lastResult = '已禁用';
      setTaskStatus(newsSyncTask, 'disabled', '已禁用');
      logger.info('[Scheduler] 新闻同步已禁用，不启动调度任务');
      return;
    }

    if (endTime > 0 && Date.now() > endTime) {
      newsSyncTask.cron = '-';
      newsSyncTask.lastResult = '已过终止时间';
      setTaskStatus(newsSyncTask, 'disabled', '已禁用');
      logger.info('[Scheduler] 新闻同步终止时间已过，不启动调度任务');
      return;
    }

    const periodType = cfg.sync_period_type || 'hour';
    const periodValue = cfg.sync_period_value || '6';
    const cronExpr = buildCronExpr(periodType, periodValue);
    await SystemConfig.upsert({ config_group: 'news', config_key: 'sync_cron_expr', config_value: cronExpr });

    const useSeconds = periodType === 'second';
    scheduleTrackedTask(newsSyncTask, cronExpr, async () => {
      const endCfg = await SystemConfig.findOne({ where: { config_group: 'news', config_key: 'sync_end_time' } });
      const currentEnd = parseInt(endCfg?.config_value) || 0;
      if (currentEnd > 0 && Date.now() > currentEnd) {
        logger.info('[Scheduler] 新闻同步已到终止时间，自动停止');
        stopTask(newsSyncTask, 'disabled', '已禁用');
        newsSyncTask.lastResult = '已到终止时间并停止';
        await SystemConfig.upsert({ config_group: 'news', config_key: 'sync_enabled', config_value: '0' });
        return { message: '已到终止时间并停止' };
      }
      return updateNews();
    }, { scheduled: true, ...(useSeconds ? { timezone: undefined } : {}) });

    logger.info(`[Scheduler] 新闻同步已启动，周期: ${periodType}/${periodValue}，cron: ${cronExpr}`);
  } catch (e) {
    logger.error(`[Scheduler] 加载新闻同步配置失败: ${e.message}`);
  }
}

// 启动所有定时任务，在服务器启动时调用一次
function start() {
  updateNews()
    .then(result => setTaskResult(newsSyncTask, result))
    .catch(e => {
      logger.error(`[Scheduler] 启动新闻同步失败: ${e.message}`);
      setTaskError(newsSyncTask, e);
    });

  reloadNewsSyncSchedule().then(() => {
    if (!newsSyncTask.handle) {
      scheduleTrackedTask(newsSyncTask, '0 */6 * * *', updateNews);
      logger.info('[Scheduler] 使用默认调度：每6小时更新新闻');
    }
  });

  scheduleTrackedTask(fixedTasks.cleanNews, fixedTasks.cleanNews.cron, cleanOldNews);
  logger.info('[Scheduler] 新闻定时清理已启动，每天凌晨3点执行');

  scheduleTrackedTask(fixedTasks.checkPredictions, fixedTasks.checkPredictions.cron, checkExpiredPredictions);
  logger.info('[Scheduler] 选股状态检查已启动，每小时执行');

  scheduleTrackedTask(fixedTasks.simPreOpen, fixedTasks.simPreOpen.cron, async () => {
    if (!isTodayTradingDay()) return { message: '今日非交易日，跳过盘前推进' };
    return runSimTasks('pre_open');
  });
  scheduleTrackedTask(fixedTasks.simPreClose, fixedTasks.simPreClose.cron, async () => {
    if (!isTodayTradingDay()) return { message: '今日非交易日，跳过收盘前推进' };
    return runSimTasks('pre_close');
  });
  logger.info('[Scheduler] 模拟交易定时任务已启动（9:25 盘前 / 14:55 收盘前，非交易日自动跳过）');

  reloadAutoWorkflowSchedule();
}

// 重载自动流程调度（前端保存配置后可调用此函数立即生效）
async function reloadAutoWorkflowSchedule() {
  for (const taskInfo of autoWorkflowTasks) {
    stopTask(taskInfo);
  }
  autoWorkflowTasks = [];

  try {
    const rows = await SystemConfig.findAll({ where: { config_group: 'workflow' } });
    const cfg = {};
    for (const r of rows) cfg[r.config_key] = r.config_value;

    const enabled = cfg.auto_enabled === '1';
    if (!enabled) {
      logger.info('[Scheduler] 自动流程已关闭，不启动调度任务');
      return;
    }

    let timeslots = [];
    try {
      timeslots = JSON.parse(cfg.auto_timeslots || '[]');
    } catch (e) {
      logger.warn(`[Scheduler] 解析自动流程时间点失败，回退默认值: ${e.message}`);
    }
    if (timeslots.length === 0) {
      const dailyCount = parseInt(cfg.pick_daily_count) || 1;
      const intervalHours = Math.max(1, Math.floor(5.5 / dailyCount));
      for (let i = 0; i < dailyCount; i++) {
        const h = 10 + i * intervalHours;
        if (h < 15) timeslots.push(`${String(h).padStart(2, '0')}:00`);
      }
    }

    const runPick = cfg.auto_run_pick !== '0';
    const runBacktest = cfg.auto_run_backtest !== '0';
    const runSimulation = cfg.auto_run_simulation !== '0';
    const skipNonTrading = cfg.auto_skip_non_trading !== '0';
    const tradingCalendar = require('./tradingCalendar');

    for (let index = 0; index < timeslots.length; index++) {
      const slot = timeslots[index];
      const [hStr, mStr] = slot.split(':');
      const h = parseInt(hStr) || 9;
      const m = parseInt(mStr) || 30;
      const expr = `${m} ${h} * * *`;
      if (!cron.validate(expr)) {
        logger.warn(`[Scheduler] 无效的 cron 表达式: ${expr}，跳过时间点 ${slot}`);
        continue;
      }

      const taskInfo = createTaskInfo(
        `自动流程 #${index + 1}`,
        expr,
        `按配置时间点 ${slot} 执行选股/回测/模拟交易`,
        'dynamic'
      );
      scheduleTrackedTask(taskInfo, expr, async () => {
        if (skipNonTrading && !tradingCalendar.isTodayTradingDay()) {
          const message = `今日非交易日，跳过自动流程 (${slot})`;
          logger.info(`[Scheduler] ${message}`);
          return { message };
        }
        return runAutoWorkflow(runPick, runBacktest, runSimulation);
      });
      autoWorkflowTasks.push(taskInfo);
    }

    logger.info(`[Scheduler] 自动流程已启动，时间点: ${timeslots.join(', ')}，跳过非交易日: ${skipNonTrading}，步骤: 选股=${runPick} 回测=${runBacktest} 模拟=${runSimulation}`);
  } catch (e) {
    logger.error(`[Scheduler] 自动流程调度配置失败: ${e.message}`);
  }
}

// 按顺序执行自动流程三步
async function runAutoWorkflow(runPick, runBacktest, runSimulation) {
  logger.info('[Scheduler] 开始执行自动流程...');
  const workflowCtrl = require('../controllers/workflowController');

  if (runPick) {
    try {
      await workflowCtrl.runAutoPickStock({ body: {} }, makeFakeRes());
    } catch (e) {
      logger.error(`[Scheduler] 自动选股异常: ${e.message}`);
    }
  }
  if (runBacktest) {
    try {
      await workflowCtrl.runAutoBacktest({ body: { wait_for_completion: true } }, makeFakeRes());
    } catch (e) {
      logger.error(`[Scheduler] 自动回测异常: ${e.message}`);
    }
  }
  if (runSimulation) {
    try {
      await workflowCtrl.runAutoSimulation({ body: {} }, makeFakeRes());
    } catch (e) {
      logger.error(`[Scheduler] 自动模拟交易异常: ${e.message}`);
    }
  }
  logger.info('[Scheduler] 自动流程执行完毕');
  return { message: '自动流程执行完毕' };
}

function makeFakeRes() {
  return {
    json: (data) => { logger.info(`[Scheduler] 自动流程结果: ${JSON.stringify(data)}`); },
    status: function() { return this; }
  };
}

// 检查并更新过期选股记录的状态
// 规则：超过观测周期 → 标记 expired；超过 2 倍周期 → 直接删除
async function checkExpiredPredictions() {
  logger.info('[Scheduler] 开始检查选股状态...');
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

    const periodDays = { '一周': 7, '一月': 30, '一年': 365 };
    const threshold = periodDays[pred.observation_period || '一月'] || 30;

    if (diffDays > threshold * 2) {
      await pred.destroy();
      deletedCount++;
    } else if (diffDays > threshold) {
      await pred.update({ status: 'expired' });
      expiredCount++;
    }
  }

  const message = `选股状态检查完成：过期 ${expiredCount} 条，删除 ${deletedCount} 条`;
  logger.info(`[Scheduler] ${message}`);
  return { message, expiredCount, deletedCount };
}

// 按交易时机推进模拟交易任务
async function runSimTasks(timing) {
  logger.info(`[Scheduler] 开始推进模拟交易任务 timing=${timing}`);
  const { SimTask } = require('../models');
  const simEngine = require('./simEngine');
  const tasks = await SimTask.findAll({
    where: { status: 'running', trade_timing: timing }
  });
  logger.info(`[Scheduler] 找到 ${tasks.length} 个 ${timing} 任务`);

  let successCount = 0;
  let failedCount = 0;
  for (const task of tasks) {
    try {
      const result = await simEngine.advanceTask(task);
      logger.info(`[Scheduler] 任务 ${task.id} (${task.stock_code}) 推进结果: ${result.action || result.reason}`);
      successCount++;
    } catch (e) {
      failedCount++;
      logger.error(`[Scheduler] 任务 ${task.id} 推进失败: ${e.message}`);
    }
  }

  return {
    message: `推进 ${timing} 任务完成，成功 ${successCount} 个，失败 ${failedCount} 个`,
    total: tasks.length,
    successCount,
    failedCount
  };
}

function getStatus() {
  const tasks = [
    ...Object.values(fixedTasks).map(getTaskSnapshot),
    getTaskSnapshot(newsSyncTask),
    ...autoWorkflowTasks.map(getTaskSnapshot)
  ];
  const summary = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});

  return {
    total: tasks.length,
    active: tasks.filter(task => task.active).length,
    running: summary.running || 0,
    scheduled: summary.scheduled || 0,
    disabled: summary.disabled || 0,
    stopped: summary.stopped || 0,
    idle: summary.idle || 0,
    refreshedAt: new Date().toISOString(),
    tasks
  };
}

module.exports = {
  start,
  reloadNewsSyncSchedule,
  buildCronExpr,
  reloadAutoWorkflowSchedule,
  getStatus
};
