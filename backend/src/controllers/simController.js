// 模拟交易控制器
// 管理 sim_tasks 和 sim_trades，提供任务的 CRUD 及手动推进接口
const { SimTask, SimTrade, StockPrediction } = require('../models');
const { Op } = require('sequelize');
const simEngine = require('../services/simEngine');
const klineService = require('../services/klineService');
const logger = require('../utils/logger');

// GET /api/sim/tasks — 任务列表（含汇总指标）
exports.getTasks = async (req, res) => {
  try {
    const tasks = await SimTask.findAll({ order: [['created_at', 'DESC']] });
    res.json({ code: 0, data: tasks });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// POST /api/sim/tasks — 新建模拟交易任务
exports.createTask = async (req, res) => {
  try {
    const {
      stock_code, stock_name,
      capital = 100000,
      strategy_type = 'ma',
      strategy_params = {},
      trade_timing = 'pre_close'
    } = req.body;

    if (!stock_code) return res.json({ code: 1, message: '股票代码不能为空' });

    const task = await SimTask.create({
      stock_code, stock_name,
      initial_capital: capital,
      cash_balance: capital,
      strategy_type,
      strategy_params,
      trade_timing,
      status: 'running',
      shares: 0, avg_cost: 0,
      total_return: 0, max_drawdown: 0,
      total_trades: 0, win_trades: 0,
      peak_value: capital
    });

    res.json({ code: 0, data: task });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// PUT /api/sim/tasks/:id — 暂停/恢复/停止
exports.updateTask = async (req, res) => {
  try {
    const task = await SimTask.findByPk(req.params.id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

    const { status } = req.body;
    if (!['running', 'paused', 'stopped'].includes(status)) {
      return res.json({ code: 1, message: '无效状态' });
    }

    await task.update({ status });
    res.json({ code: 0, data: task });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// DELETE /api/sim/tasks/:id — 删除任务及其交易记录
exports.deleteTask = async (req, res) => {
  try {
    const task = await SimTask.findByPk(req.params.id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

    await SimTrade.destroy({ where: { task_id: task.id } });
    await task.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// GET /api/sim/tasks/:id — 详情（含K线、资金曲线、交易记录）
exports.getTask = async (req, res) => {
  try {
    const task = await SimTask.findByPk(req.params.id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

    const trades = await SimTrade.findAll({
      where: { task_id: task.id },
      order: [['trade_date', 'ASC']]
    });

    // 构建资金曲线：从创建日到最后执行日
    const equityCurve = buildEquityCurve(task, trades);

    // 获取K线数据用于图表（最近120条）
    let klineData = [];
    try {
      const endDate = task.last_run_date || new Date().toISOString().slice(0, 10);
      const startDate = offsetDate(endDate, -180);
      klineData = await klineService.getKlines(task.stock_code, startDate, endDate);
    } catch (e) {
      logger.warn(`[SimController] 获取K线失败: ${e.message}`);
    }

    // 当前持仓市值（用最新K线收盘价）
    let currentPrice = 0;
    let floatPL = 0;
    if (klineData.length > 0) {
      currentPrice = klineData[klineData.length - 1].close;
      if (task.shares > 0) {
        floatPL = parseFloat(((currentPrice - parseFloat(task.avg_cost)) * task.shares).toFixed(2));
      }
    }

    res.json({
      code: 0,
      data: {
        task: task.toJSON(),
        trades,
        equityCurve,
        klineData,
        currentPrice,
        floatPL
      }
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// POST /api/sim/tasks/:id/run — 手动推进一步（调试用）
exports.runTask = async (req, res) => {
  try {
    const task = await SimTask.findByPk(req.params.id);
    if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

    const result = await simEngine.advanceTask(task);
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// GET /api/sim/stocks — 可选股票（来自LLM选股，不限状态）
exports.getStocks = async (req, res) => {
  try {
    const stocks = await StockPrediction.findAll({
      attributes: ['stock_code', 'stock_name'],
      group: ['stock_code', 'stock_name'],
      order: [['stock_code', 'ASC']]
    });
    res.json({ code: 0, data: stocks });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 根据交易记录重建资金曲线
function buildEquityCurve(task, trades) {
  if (trades.length === 0) return [];
  const curve = [];
  let cash = parseFloat(task.initial_capital);
  let shares = 0;
  let avgCost = 0;

  // 按交易日期分组
  const tradeMap = new Map();
  for (const t of trades) {
    if (!tradeMap.has(t.trade_date)) tradeMap.set(t.trade_date, []);
    tradeMap.get(t.trade_date).push(t);
  }

  for (const [date, dayTrades] of tradeMap) {
    for (const t of dayTrades) {
      if (t.type === 'buy') {
        cash = parseFloat(t.cash_after);
        shares = t.shares;
        avgCost = parseFloat(t.price);
      } else {
        cash = parseFloat(t.cash_after);
        shares = 0;
        avgCost = 0;
      }
    }
    const price = shares > 0 ? avgCost : 0;
    curve.push({ date, value: parseFloat((cash + shares * price).toFixed(2)) });
  }
  return curve;
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
