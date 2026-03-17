// 策略回测控制器
// 核心流程：获取 K 线数据 → 计算技术指标 → 逐日模拟交易 → 统计结果 → 存库
const { BacktestConfig, BacktestResult, StockPrediction, BacktestStrategy } = require('../models');
const DataService = require('../services/DataService');
const Strategy = require('../strategies');
const { calculateAllIndicators } = require('../strategies/indicators');

// 统一通过策略模块计算信号，屏蔽各策略实现差异
const calculateStrategySignal = (strategyType, data, index, params) => {
  return Strategy.calculateSignal(strategyType, data, index, params);
};

// ========== 主回测函数 ==========
// 数据来源：通过 DataService 读取系统配置中选定的数据提供商
exports.runBacktest = async (req, res) => {
  try {
    const {
      stock_code, stock_name, start_date, end_date,
      initial_capital = 100000, strategy_type = 'ma', strategy_id,
      params = {}
    } = req.body;

    // 解析策略参数，未传则使用各策略默认值
    const {
      short_period = 5, long_period = 20,
      rsi_period = 14, oversold = 30, overbought = 70,
      fast_period = 12, slow_period = 26, signal_period = 9,
      boll_period = 20, std_dev = 2,
      breakout_period = 20,
      stop_loss_pct = 0.05, take_profit_pct = 0.15  // 止损 5%，止盈 15%
    } = params;

    // 通过 DataService 获取历史数据（遵循系统配置的数据提供商）
    // 直接传入日期范围，由 Python 脚本按范围拉取，无需估算条数
    let allData = [];
    try {
      allData = await DataService.getStockHistory(stock_code, 'daily', 2000, start_date, end_date);
    } catch (e) {}

    if (!allData || allData.length === 0) {
      return res.json({ code: 1, message: '无法获取股票数据' });
    }

    // 按日期升序排列，确保回测顺序正确
    allData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 过滤到用户指定的日期范围
    const klineData = allData.filter(d => d.date >= start_date && d.date <= end_date);
    if (klineData.length < 10) {
      return res.json({ code: 1, message: '数据量不足' });
    }

    // 提取收盘价序列，用于指标计算
    const prices = klineData.map(k => k.close);

    // 预计算所有技术指标（MA/RSI/MACD/BOLL/Breakout）
    const indicatorParams = {
      short_period, long_period, rsi_period,
      fast_period, slow_period, signal_period,
      boll_period, std_dev, breakout_period
    };
    const data = calculateAllIndicators(prices, indicatorParams, klineData);

    // ── 回测状态变量 ──────────────────────────────────────────
    let capital = initial_capital;  // 当前可用资金
    let totalShares = 0;            // 当前持股数量
    let inPosition = false;         // 是否持仓中
    let avgCost = 0;                // 持仓均价
    let lastBuyShares = 0;          // 最近一次买入股数（用于平仓）
    const trades = [];              // 所有交易记录
    const equityCurve = [];         // 权益曲线（每日总资产）
    const buyPoints = [];           // 买入点坐标（用于图表标注）
    const sellPoints = [];          // 卖出点坐标

    // 构建传给策略的参数对象
    const strategyParams = {
      short_period, long_period, rsi_period, oversold, overbought,
      fast_period, slow_period, signal_period,
      boll_period, std_dev, breakout_period,
      stop_loss_pct, take_profit_pct
    };

    // ── 逐日模拟交易 ──────────────────────────────────────────
    // 从第 2 天开始（index=1），因为策略信号需要前一天数据
    for (let i = 1; i < klineData.length; i++) {
      const date = klineData[i].date;
      const price = klineData[i].close;

      // 记录当日权益（现金 + 持仓市值）
      equityCurve.push({ date, value: parseFloat((capital + totalShares * price).toFixed(2)) });

      // 获取策略信号
      const signal = calculateStrategySignal(strategy_type, data, i, strategyParams);
      let shouldBuy = signal.shouldBuy;
      let shouldSell = signal.shouldSell;
      let signalReason = signal.reason;

      // 卖出原因默认使用策略信号描述
      let sellReason = (shouldSell && signal.reason) ? signal.reason : '信号触发';

      // ── 止盈止损判断（优先级高于策略信号）──────────────────
      let stopLossTakeProfitReason = '';
      if (inPosition && avgCost > 0) {
        const pct = (price - avgCost) / avgCost * 100;
        if (pct >= take_profit_pct * 100) {
          stopLossTakeProfitReason = `止盈(+${pct.toFixed(2)}%)`;
          shouldSell = true;
        } else if (pct <= -stop_loss_pct * 100) {
          stopLossTakeProfitReason = `止损(${pct.toFixed(2)}%)`;
          shouldSell = true;
        }
      }
      // 止盈止损原因覆盖策略原因
      if (stopLossTakeProfitReason) {
        sellReason = stopLossTakeProfitReason;
      }

      // ── 买入逻辑 ─────────────────────────────────────────────
      // 使用 95% 资金买入，预留 5% 作为缓冲
      if (shouldBuy && !inPosition) {
        const buyAmt = capital * 0.95;
        const shares = Math.floor(buyAmt / price);
        if (shares > 0) {
          const cost = shares * price;
          capital -= cost;
          totalShares = shares;
          lastBuyShares = shares;
          avgCost = price;
          inPosition = true;
          trades.push({
            date, type: 'buy', price: parseFloat(price.toFixed(2)),
            shares, amount: parseFloat(cost.toFixed(2)),
            account_balance: parseFloat(capital.toFixed(2)),
            signal: signalReason || '金叉信号'
          });
          buyPoints.push({ date, price });
        }
      }

      // ── 卖出逻辑 ─────────────────────────────────────────────
      if (shouldSell && inPosition) {
        const sellShares = totalShares > 0 ? totalShares : lastBuyShares;
        if (sellShares > 0) {
          const sellAmt = sellShares * price;
          const profit = sellAmt - sellShares * avgCost;
          capital += sellAmt;

          // 计算持仓天数
          const buyTrade = trades.filter(t => t.type === 'buy').pop();
          let holdDays = 0;
          if (buyTrade) {
            holdDays = Math.floor((new Date(date) - new Date(buyTrade.date)) / (1000 * 60 * 60 * 24));
          }

          trades.push({
            date, type: 'sell', price: parseFloat(price.toFixed(2)),
            shares: sellShares, amount: parseFloat(sellAmt.toFixed(2)),
            profit: parseFloat(profit.toFixed(2)),
            account_balance: parseFloat(capital.toFixed(2)),
            hold_days: holdDays,
            price_change: buyTrade ? parseFloat(((price - buyTrade.price) / buyTrade.price * 100).toFixed(2)) : 0,
            sell_reason: sellReason
          });
          sellPoints.push({ date, price });
          totalShares = 0;
        }
        inPosition = false;
        avgCost = 0;
      }
    }

    // ── 到期强制平仓（回测结束时仍持仓则按最后一天收盘价卖出）──
    if (inPosition && klineData.length > 0) {
      const lastData = klineData[klineData.length - 1];
      const sellShares = totalShares > 0 ? totalShares : lastBuyShares;
      if (sellShares > 0) {
        const sellAmt = sellShares * lastData.close;
        const profit = sellAmt - sellShares * avgCost;
        capital += sellAmt;
        trades.push({
          date: lastData.date, type: 'sell', price: parseFloat(lastData.close.toFixed(2)),
          shares: sellShares, amount: parseFloat(sellAmt.toFixed(2)),
          profit: parseFloat(profit.toFixed(2)),
          account_balance: parseFloat(capital.toFixed(2)),
          sell_reason: '到期平仓'
        });
      }
    }

    // ── 统计回测结果 ──────────────────────────────────────────
    const finalCapital = capital;
    const totalReturn = ((finalCapital - initial_capital) / initial_capital) * 100;
    const sellTrades = trades.filter(t => t.type === 'sell');
    const winTrades = sellTrades.filter(t => t.profit > 0);
    const winRate = sellTrades.length > 0 ? (winTrades.length / sellTrades.length) * 100 : 0;

    // ── 准备图表数据（K 线 + 各指标）────────────────────────────
    const klineForChart = klineData.map(k => ({
      date: k.date, open: k.open, close: k.close, high: k.high, low: k.low, volume: k.volume
    }));
    const ma5ForChart    = data.ma5.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null);
    const ma20ForChart   = data.ma20.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null);
    const rsiForChart    = data.rsi.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null);
    const macdForChart   = data.macdLine.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(4)) : null);
    const signalForChart = data.signalLine.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(4)) : null);
    const bollUpperForChart = data.bollUpper.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null);
    const bollLowerForChart = data.bollLower.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null);

    // 将完整结果持久化到数据库
    const result = await BacktestResult.create({
      stock_code, stock_name, start_date, end_date,
      initial_capital, final_capital: finalCapital,
      total_return: totalReturn,
      strategy_id, strategy_params_json: params,
      trades_json: trades,
      equity_curve: equityCurve,
      kline_data: klineForChart,
      buy_points: buyPoints,
      sell_points: sellPoints,
      ma5: ma5ForChart, ma20: ma20ForChart,
      rsi: rsiForChart, macd: macdForChart, signal: signalForChart,
      boll_upper: bollUpperForChart, boll_lower: bollLowerForChart,
      total_trades: sellTrades.length,
      profit_trades: winTrades.length,
      loss_trades: sellTrades.length - winTrades.length,
      win_rate: winRate
    });

    res.json({ code: 0, data: result.toJSON() });
  } catch (e) {
    const logger = require('../utils/logger');
    logger.error('回测失败:', e);
    res.status(500).json({ code: 500, message: e.message });
  }
};

// ── 回测配置 CRUD ─────────────────────────────────────────────

// 获取所有回测配置（按创建时间倒序）
exports.getConfigs = async (req, res) => {
  try {
    const configs = await BacktestConfig.findAll({ order: [['created_at', 'DESC']] });
    res.json({ code: 0, data: configs });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
};

exports.createConfig = async (req, res) => {
  try {
    const config = await BacktestConfig.create(req.body);
    res.json({ code: 0, data: config });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
};

exports.updateConfig = async (req, res) => {
  try {
    const config = await BacktestConfig.findByPk(req.params.id);
    if (!config) return res.status(404).json({ code: 404, message: '不存在' });
    await config.update(req.body);
    res.json({ code: 0, data: config });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
};

exports.deleteConfig = async (req, res) => {
  try {
    await BacktestConfig.destroy({ where: { id: req.params.id } });
    res.json({ code: 0, message: '删除成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
};

// ── 回测结果 CRUD ─────────────────────────────────────────────

// 获取结果列表时排除大字段（K 线、指标数组），减少传输量
exports.getResults = async (req, res) => {
  try {
    const results = await BacktestResult.findAll({
      attributes: { exclude: ['kline_data', 'buy_points', 'sell_points', 'ma5', 'ma20', 'rsi', 'macd', 'signal', 'boll_upper', 'boll_lower', 'equity_curve'] },
      order: [['created_at', 'DESC']]
    });
    res.json({ code: 0, data: results });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
};

// 获取单条结果（含完整图表数据，用于详情页展示）
exports.getResult = async (req, res) => {
  try {
    const result = await BacktestResult.findByPk(req.params.id);
    if (!result) return res.status(404).json({ code: 404, message: '不存在' });
    res.json({ code: 0, data: result });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
};

exports.deleteResult = async (req, res) => {
  try {
    await BacktestResult.destroy({ where: { id: req.params.id } });
    res.json({ code: 0, message: '删除成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
};

// 获取可用于回测的股票列表（从当前活跃选股记录中提取）
exports.getBacktestStocks = async (req, res) => {
  try {
    const stocks = await StockPrediction.findAll({
      where: { status: 'active' },
      attributes: ['stock_code', 'stock_name'],
      group: ['stock_code', 'stock_name']
    });
    res.json({ code: 0, data: stocks });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
};
