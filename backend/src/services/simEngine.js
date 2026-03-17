// 模拟交易核心引擎
// 逐日推进逻辑：获取K线 → 检查涨跌停 → 计算指标 → 策略信号 → 执行买卖 → 更新任务
const { SimTask, SimTrade } = require('../models');
const klineService = require('./klineService');
const Strategy = require('../strategies');
const { calculateAllIndicators } = require('../strategies/indicators');
const logger = require('../utils/logger');
const { getNextTradingDay, isTodayTradingDay } = require('./tradingCalendar');
const { getTodayStr } = require('../utils/dateUtils');

const SLIPPAGE_BUY  = 0.001;  // 买入滑点 0.1%
const SLIPPAGE_SELL = 0.001;  // 卖出滑点 0.1%
const MIN_KLINE_COUNT = 30;   // 指标计算所需最少K线数

/**
 * 推进单个模拟交易任务一步（一个交易日）
 * @param {number|SimTask} taskOrId
 * @returns {{ advanced: boolean, date: string, action: string }}
 */
async function advanceTask(taskOrId) {
  const task = typeof taskOrId === 'object' ? taskOrId
    : await SimTask.findByPk(taskOrId);

  if (!task || task.status !== 'running') {
    return { advanced: false, reason: 'task not running' };
  }

  // 非交易日直接跳过（节假日/周末）
  if (!isTodayTradingDay()) {
    return { advanced: false, reason: 'not a trading day' };
  }

  // 确定本次要执行的交易日
  const today = getTodayStr();
  const nextDate = task.last_run_date
    ? getNextTradingDay(task.last_run_date)
    : today;

  if (nextDate > today) {
    return { advanced: false, reason: 'no new trading day' };
  }

  // 获取足够的历史K线用于指标计算
  const klines = await klineService.getRecentKlines(task.stock_code, nextDate, MIN_KLINE_COUNT + 5);
  if (!klines || klines.length < 5) {
    logger.warn(`[SimEngine] ${task.stock_code} ${nextDate} K线数据不足`);
    await task.update({ last_run_date: nextDate });
    return { advanced: true, date: nextDate, action: 'skip_no_data' };
  }

  // 当日K线（最后一条）
  const todayKline = klines[klines.length - 1];
  if (todayKline.date !== nextDate) {
    // 当日无交易数据（非交易日），跳过
    await task.update({ last_run_date: nextDate });
    return { advanced: true, date: nextDate, action: 'skip_non_trading' };
  }

  const price = todayKline.close;
  const prevKline = klines.length >= 2 ? klines[klines.length - 2] : null;

  // 检查涨跌停
  const { isLimitUp, isLimitDown } = checkLimitUpDown(task.stock_code, todayKline, prevKline);

  // 计算技术指标
  const prices = klines.map(k => k.close);
  const params = task.strategy_params || {};
  const indicatorParams = buildIndicatorParams(params);
  const data = calculateAllIndicators(prices, indicatorParams, klines);
  const lastIdx = klines.length - 1;

  // 策略信号
  const strategyParams = buildStrategyParams(params);
  let signal = { shouldBuy: false, shouldSell: false, reason: '' };
  try {
    signal = Strategy.calculateSignal(task.strategy_type, data, lastIdx, strategyParams);
  } catch (e) {
    logger.warn(`[SimEngine] 策略信号计算失败: ${e.message}`);
  }

  let { shouldBuy, shouldSell } = signal;
  let signalReason = signal.reason || '';

  // 止盈止损（优先级高于策略信号）
  const stopLossPct  = params.stop_loss_pct  || 0.05;
  const takeProfitPct = params.take_profit_pct || 0.15;
  if (task.shares > 0 && task.avg_cost > 0) {
    const pct = (price - parseFloat(task.avg_cost)) / parseFloat(task.avg_cost);
    if (pct >= takeProfitPct) {
      shouldSell = true;
      signalReason = `止盈(+${(pct * 100).toFixed(2)}%)`;
    } else if (pct <= -stopLossPct) {
      shouldSell = true;
      signalReason = `止损(${(pct * 100).toFixed(2)}%)`;
    }
  }

  let action = 'hold';
  const cashBalance = parseFloat(task.cash_balance);

  // 买入
  if (shouldBuy && task.shares === 0 && !isLimitUp) {
    const buyPrice = parseFloat((price * (1 + SLIPPAGE_BUY)).toFixed(3));
    const buyAmt   = cashBalance * 0.95;
    const shares   = Math.floor(buyAmt / buyPrice / 100) * 100; // 整手
    if (shares >= 100) {
      const cost      = parseFloat((shares * buyPrice).toFixed(2));
      const slippage  = parseFloat((shares * price * SLIPPAGE_BUY).toFixed(2));
      const cashAfter = parseFloat((cashBalance - cost).toFixed(2));

      await SimTrade.create({
        task_id: task.id, trade_date: nextDate, type: 'buy',
        price: buyPrice, raw_price: price, shares, amount: cost,
        slippage, signal_reason: signalReason,
        is_limit_up: false, is_limit_down: false,
        cash_before: cashBalance, cash_after: cashAfter,
        profit_loss: 0, hold_days: 0
      });

      const totalValue = cashAfter + shares * price;
      const peakValue  = Math.max(parseFloat(task.peak_value) || totalValue, totalValue);
      await task.update({
        shares, avg_cost: buyPrice, cash_balance: cashAfter,
        last_run_date: nextDate, peak_value: peakValue
      });
      action = 'buy';
    }
  }
  // 卖出
  else if (shouldSell && task.shares > 0 && !isLimitDown) {
    const sellPrice  = parseFloat((price * (1 - SLIPPAGE_SELL)).toFixed(3));
    const sellShares = task.shares;
    const sellAmt    = parseFloat((sellShares * sellPrice).toFixed(2));
    const slippage   = parseFloat((sellShares * price * SLIPPAGE_SELL).toFixed(2));
    const cashAfter  = parseFloat((cashBalance + sellAmt).toFixed(2));
    const profitLoss = parseFloat((sellAmt - sellShares * parseFloat(task.avg_cost)).toFixed(2));

    // 计算持仓天数
    const lastBuy = await SimTrade.findOne({
      where: { task_id: task.id, type: 'buy' },
      order: [['trade_date', 'DESC']]
    });
    const holdDays = lastBuy
      ? Math.floor((new Date(nextDate) - new Date(lastBuy.trade_date)) / 86400000)
      : 0;

    await SimTrade.create({
      task_id: task.id, trade_date: nextDate, type: 'sell',
      price: sellPrice, raw_price: price, shares: sellShares, amount: sellAmt,
      slippage, signal_reason: signalReason,
      is_limit_up: false, is_limit_down: isLimitDown,
      cash_before: cashBalance, cash_after: cashAfter,
      profit_loss: profitLoss, hold_days: holdDays
    });

    const isWin = profitLoss > 0;
    const totalTrades = (task.total_trades || 0) + 1;
    const winTrades   = (task.win_trades || 0) + (isWin ? 1 : 0);

    // 更新总收益率和最大回撤
    const totalReturn  = ((cashAfter - parseFloat(task.initial_capital)) / parseFloat(task.initial_capital)) * 100;
    const peakValue    = parseFloat(task.peak_value) || cashAfter;
    const drawdown     = peakValue > 0 ? ((peakValue - cashAfter) / peakValue) * 100 : 0;
    const maxDrawdown  = Math.max(parseFloat(task.max_drawdown) || 0, drawdown);

    await task.update({
      shares: 0, avg_cost: 0, cash_balance: cashAfter,
      last_run_date: nextDate,
      total_trades: totalTrades, win_trades: winTrades,
      total_return: totalReturn, max_drawdown: maxDrawdown
    });
    action = 'sell';
  }
  // 涨停无法买入
  else if (shouldBuy && isLimitUp) {
    action = 'skip_limit_up';
    await task.update({ last_run_date: nextDate });
  }
  // 跌停无法卖出
  else if (shouldSell && isLimitDown) {
    action = 'skip_limit_down';
    await task.update({ last_run_date: nextDate });
  }
  else {
    await task.update({ last_run_date: nextDate });
  }

  // 持仓时更新总收益率（含浮盈）
  if (task.shares > 0 && action === 'hold') {
    const totalValue  = cashBalance + task.shares * price;
    const totalReturn = ((totalValue - parseFloat(task.initial_capital)) / parseFloat(task.initial_capital)) * 100;
    const peakValue   = Math.max(parseFloat(task.peak_value) || totalValue, totalValue);
    const drawdown    = peakValue > 0 ? ((peakValue - totalValue) / peakValue) * 100 : 0;
    const maxDrawdown = Math.max(parseFloat(task.max_drawdown) || 0, drawdown);
    await task.update({ total_return: totalReturn, max_drawdown: maxDrawdown, peak_value: peakValue });
  }

  return { advanced: true, date: nextDate, action };
}

/**
 * 批量推进所有 running 状态的任务
 * 由定时任务调用
 */
async function runAllTasks() {
  const tasks = await SimTask.findAll({ where: { status: 'running' } });
  logger.info(`[SimEngine] 开始推进 ${tasks.length} 个模拟交易任务`);
  const results = [];
  for (const task of tasks) {
    try {
      const r = await advanceTask(task);
      results.push({ taskId: task.id, ...r });
    } catch (e) {
      logger.error(`[SimEngine] 任务 ${task.id} 推进失败: ${e.message}`);
      results.push({ taskId: task.id, advanced: false, error: e.message });
    }
  }
  return results;
}

// 检查涨跌停（A股规则：普通股±10%，ST股±5%）
function checkLimitUpDown(stockCode, todayKline, prevKline) {
  if (!prevKline) return { isLimitUp: false, isLimitDown: false };
  const isST = stockCode.includes('ST') || false;
  const limit = isST ? 0.05 : 0.10;
  const prevClose = parseFloat(prevKline.close);
  const todayClose = parseFloat(todayKline.close);
  const pct = (todayClose - prevClose) / prevClose;
  return {
    isLimitUp:   pct >= limit - 0.001,
    isLimitDown: pct <= -(limit - 0.001)
  };
}

function buildIndicatorParams(params) {
  return {
    short_period:    params.short_period    || 5,
    long_period:     params.long_period     || 20,
    rsi_period:      params.rsi_period      || 14,
    fast_period:     params.fast_period     || 12,
    slow_period:     params.slow_period     || 26,
    signal_period:   params.signal_period   || 9,
    boll_period:     params.boll_period     || 20,
    std_dev:         params.std_dev         || 2,
    breakout_period: params.breakout_period || 20
  };
}

function buildStrategyParams(params) {
  return {
    ...buildIndicatorParams(params),
    oversold:        params.oversold        || 30,
    overbought:      params.overbought      || 70,
    stop_loss_pct:   params.stop_loss_pct   || 0.05,
    take_profit_pct: params.take_profit_pct || 0.15
  };
}

module.exports = { advanceTask, runAllTasks };
