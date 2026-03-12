const { BacktestConfig, BacktestResult, StockPrediction, BacktestStrategy } = require('../models');
const DataService = require('../services/DataService');

// ========== 辅助函数：计算简单均线 ==========
const calcMA = (prices, period) => {
  const result = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      result.push(sum / period);
    }
  }
  return result;
};

// ========== 指标计算函数 ==========

// RSI 计算
const calculateRSI = (prices, period = 14) => {
  const rsi = [];
  const changes = [];
  
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i-1]);
  }
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      rsi.push(null);
    } else {
      let gains = 0, losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        if (changes[j-1] > 0) gains += changes[j-1];
        else losses -= changes[j-1];
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
  }
  return rsi;
};

// EMA 计算
const calculateEMA = (prices, period) => {
  const ema = [];
  const multiplier = 2 / (period + 1);
  
  // 初始 SMA
  let sum = 0;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ema.push(null);
    } else if (i === period - 1) {
      sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      ema.push(sum / period);
    } else {
      const prevEma = ema[i - 1];
      ema.push((prices[i] - prevEma) * multiplier + prevEma);
    }
  }
  return ema;
};

// MACD 计算
const calculateMACD = (prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);
  
  // MACD 线 = 快线 - 慢线
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }
  }
  
  // 信号线 = MACD 的 EMA
  const validMacd = macdLine.filter(v => v !== null);
  const validSignal = calculateEMA(validMacd, signalPeriod);
  
  // 合并回去
  const signalLine = [];
  let signalIdx = 0;
  for (let i = 0; i < prices.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
    } else {
      signalLine.push(validSignal[signalIdx]);
      signalIdx++;
    }
  }
  
  // 柱状图 = MACD - 信号线
  const histogram = [];
  for (let i = 0; i < prices.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macdLine[i] - signalLine[i]);
    }
  }
  
  return { macdLine, signalLine, histogram };
};

// 布林带计算
const calculateBOLL = (prices, period = 20, stdDev = 2) => {
  const middle = [];
  const upper = [];
  const lower = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      middle.push(null);
      upper.push(null);
      lower.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      const sma = sum / period;
      
      // 计算标准差
      let variance = 0;
      for (let j = 0; j < period; j++) {
        variance += Math.pow(prices[i - j] - sma, 2);
      }
      const std = Math.sqrt(variance / period);
      
      middle.push(sma);
      upper.push(sma + stdDev * std);
      lower.push(sma - stdDev * std);
    }
  }
  
  return { middle, upper, lower };
};

// 突破策略：计算N日高低点
const calculateBreakout = (prices, period = 20) => {
  const highs = [];
  const lows = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      highs.push(null);
      lows.push(null);
    } else {
      let maxPrice = prices[i];
      let minPrice = prices[i];
      for (let j = 1; j < period; j++) {
        maxPrice = Math.max(maxPrice, prices[i - j]);
        minPrice = Math.min(minPrice, prices[i - j]);
      }
      highs.push(maxPrice);
      lows.push(minPrice);
    }
  }
  
  return { highs, lows };
};

// ========== 策略信号计算函数 ==========

// RSI 策略
const calculateRSISignal = (data, index, params) => {
  const { rsi_period = 14, oversold = 30, overbought = 70 } = params;
  const rsi = data.rsi[index];
  
  if (rsi === null || rsi === undefined) return { shouldBuy: false, shouldSell: false, reason: '' };
  
  if (rsi < oversold) {
    return { shouldBuy: true, shouldSell: false, reason: `RSI超卖(${rsi.toFixed(1)}<${oversold})` };
  }
  if (rsi > overbought) {
    return { shouldBuy: false, shouldSell: true, reason: `RSI超买(${rsi.toFixed(1)}>${overbought})` };
  }
  return { shouldBuy: false, shouldSell: false, reason: '' };
};

// MACD 策略
const calculateMACDSignal = (data, index, params) => {
  const macdLine = data.macdLine[index];
  const macdLinePrev = data.macdLine[index - 1];
  const signalLine = data.signalLine[index];
  const signalLinePrev = data.signalLine[index - 1];
  
  if (macdLine === null || macdLinePrev === null || signalLine === null || signalLinePrev === null) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }
  
  // 金叉：MACD线从下穿过信号线
  if (macdLinePrev <= signalLinePrev && macdLine > signalLine) {
    return { shouldBuy: true, shouldSell: false, reason: 'MACD金叉' };
  }
  
  // 死叉：MACD线从上穿过信号线
  if (macdLinePrev >= signalLinePrev && macdLine < signalLine) {
    return { shouldBuy: false, shouldSell: true, reason: 'MACD死叉' };
  }
  
  return { shouldBuy: false, shouldSell: false, reason: '' };
};

// BOLL 策略
const calculateBOLLSignal = (data, index, params) => {
  const { boll_period = 20, std_dev = 2 } = params;
  const price = data.prices[index];
  const upper = data.bollUpper[index];
  const lower = data.bollLower[index];
  
  if (upper === null || lower === null) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }
  
  // 突破上轨买入（超买）
  if (price > upper) {
    return { shouldBuy: true, shouldSell: false, reason: `BOLL突破上轨(${price.toFixed(2)}>${upper.toFixed(2)})` };
  }
  
  // 跌破下轨卖出（超卖）
  if (price < lower) {
    return { shouldBuy: false, shouldSell: true, reason: `BOLL跌破下轨(${price.toFixed(2)}<${lower.toFixed(2)})` };
  }
  
  return { shouldBuy: false, shouldSell: false, reason: '' };
};

// 突破策略
const calculateBreakoutSignal = (data, index, params) => {
  const { breakout_period = 20 } = params;
  const price = data.prices[index];
  const highs = data.breakoutHighs[index];
  const lows = data.breakoutLows[index];
  
  if (highs === null || lows === null) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }
  
  // 突破N日高点
  if (price > highs) {
    return { shouldBuy: true, shouldSell: false, reason: `突破${breakout_period}日高点(${price.toFixed(2)}>${highs.toFixed(2)})` };
  }
  
  // 跌破N日低点
  if (price < lows) {
    return { shouldBuy: false, shouldSell: true, reason: `跌破${breakout_period}日低点(${price.toFixed(2)}<${lows.toFixed(2)})` };
  }
  
  return { shouldBuy: false, shouldSell: false, reason: '' };
};

// MA 策略（原有逻辑）
const calculateMASignal = (data, index, params) => {
  const { short_period = 5, long_period = 20 } = params;
  const ma5 = data.ma5[index];
  const ma5Prev = data.ma5[index - 1];
  const ma20 = data.ma20[index];
  const ma20Prev = data.ma20[index - 1];
  
  if (ma5 === null || ma5Prev === null || ma20 === null || ma20Prev === null) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }
  
  // 金叉
  if (ma5Prev <= ma20Prev && ma5 > ma20) {
    return { shouldBuy: true, shouldSell: false, reason: 'MA金叉' };
  }
  
  // 死叉
  if (ma5Prev >= ma20Prev && ma5 < ma20) {
    return { shouldBuy: false, shouldSell: true, reason: 'MA死叉' };
  }
  
  return { shouldBuy: false, shouldSell: false, reason: '' };
};

// 策略分发函数
const calculateStrategySignal = (strategyType, data, index, params) => {
  switch (strategyType) {
    case 'rsi':
      return calculateRSISignal(data, index, params);
    case 'macd':
      return calculateMACDSignal(data, index, params);
    case 'boll':
      return calculateBOLLSignal(data, index, params);
    case 'breakout':
      return calculateBreakoutSignal(data, index, params);
    case 'ma':
    default:
      return calculateMASignal(data, index, params);
  }
};

// ========== 主回测函数 ==========
exports.runBacktest = async (req, res) => {
  try {
    const { 
      stock_code, stock_name, start_date, end_date, 
      initial_capital = 100000, strategy_type = 'ma', strategy_id,
      params = {}
    } = req.body;

    // 解析策略参数
    const {
      short_period = 5, long_period = 20,
      rsi_period = 14, oversold = 30, overbought = 70,
      fast_period = 12, slow_period = 26, signal_period = 9,
      boll_period = 20, std_dev = 2,
      breakout_period = 20,
      stop_loss_pct = 0.05, take_profit_pct = 0.15
    } = params;

    // 获取数据
    const SinaStockAPI = require('../services/providers/SinaStockProvider');
    let allData = [];
    try {
      allData = await SinaStockAPI.getKline(stock_code, start_date, end_date);
    } catch (e) {}
    
    if (!allData || allData.length === 0) {
      try { allData = await DataService.getStockHistory(stock_code, 'daily', 500); } catch {}
    }

    if (!allData || allData.length === 0) {
      return res.json({ code: 1, message: '无法获取股票数据' });
    }

    allData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 过滤日期
    const klineData = allData.filter(d => d.date >= start_date && d.date <= end_date);
    if (klineData.length < 10) {
      return res.json({ code: 1, message: '数据量不足' });
    }

    // 提取价格数据
    const prices = klineData.map(k => k.close);
    
    // 预计算所有指标
    const data = {
      prices,
      ma5: calcMA(prices, short_period),
      ma20: calcMA(prices, long_period),
      rsi: calculateRSI(prices, rsi_period),
      macdLine: [],
      signalLine: [],
      histogram: [],
      bollUpper: [],
      bollMiddle: [],
      bollLower: [],
      breakoutHighs: [],
      breakoutLows: []
    };
    
    // 计算 MACD
    const macdResult = calculateMACD(prices, fast_period, slow_period, signal_period);
    data.macdLine = macdResult.macdLine;
    data.signalLine = macdResult.signalLine;
    data.histogram = macdResult.histogram;
    
    // 计算 BOLL
    const bollResult = calculateBOLL(prices, boll_period, std_dev);
    data.bollUpper = bollResult.upper;
    data.bollMiddle = bollResult.middle;
    data.bollLower = bollResult.lower;
    
    // 计算突破高低点
    const breakoutResult = calculateBreakout(prices, breakout_period);
    data.breakoutHighs = breakoutResult.highs;
    data.breakoutLows = breakoutResult.lows;

    // 回测
    let capital = initial_capital;
    let totalShares = 0;
    let inPosition = false;
    let avgCost = 0;
    let lastBuyShares = 0;
    const trades = [];
    const equityCurve = [];
    const buyPoints = [];
    const sellPoints = [];

    // 构建统一的策略参数
    const strategyParams = {
      short_period,
      long_period,
      rsi_period,
      oversold,
      overbought,
      fast_period,
      slow_period,
      signal_period,
      boll_period,
      std_dev,
      breakout_period,
      stop_loss_pct,
      take_profit_pct
    };

    for (let i = 1; i < klineData.length; i++) {
      const date = klineData[i].date;
      const price = klineData[i].close;
      
      // 记录权益曲线
      equityCurve.push({ date, value: parseFloat((capital + totalShares * price).toFixed(2)) });
      
      // 获取策略信号
      const signal = calculateStrategySignal(strategy_type, data, i, strategyParams);
      let shouldBuy = signal.shouldBuy;
      let shouldSell = signal.shouldSell;
      let signalReason = signal.reason;
      
      // DEBUG: log strategy signal
      if (i >= klineData.length - 5) {
        console.log(`[DEBUG] ${date} price=${price.toFixed(2)} strategy=${strategy_type} signal=${JSON.stringify(signal)}`);
      }
      
      // 只有当策略明确给出卖出信号且有原因时，才使用策略原因
      let sellReason = (shouldSell && signal.reason) ? signal.reason : '信号触发';

      // 止盈止损（与策略信号独立判断）
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
      
      // 止盈止损优先
      if (stopLossTakeProfitReason) {
        sellReason = stopLossTakeProfitReason;
      }

      // 买入
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

      // 卖出
      if (shouldSell && inPosition) {
        const sellShares = totalShares > 0 ? totalShares : lastBuyShares;
        if (sellShares > 0) {
          const sellAmt = sellShares * price;
          const profit = sellAmt - sellShares * avgCost;
          capital += sellAmt;
          
          // 查找最近买入
          const buyTrade = trades.filter(t => t.type === 'buy').pop();
          let holdDays = 0;
          if (buyTrade) {
            holdDays = Math.floor((new Date(date) - new Date(buyTrade.date)) / (1000*60*60*24));
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

    // 最后一天平仓
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

    // 计算结果
    const finalCapital = capital;
    const totalReturn = ((finalCapital - initial_capital) / initial_capital) * 100;
    const sellTrades = trades.filter(t => t.type === 'sell');
    const winTrades = sellTrades.filter(t => t.profit > 0);
    const winRate = sellTrades.length > 0 ? (winTrades.length / sellTrades.length) * 100 : 0;

    // 准备K线图表数据
    const klineForChart = klineData.map(k => ({
      date: k.date, open: k.open, close: k.close, high: k.high, low: k.low, volume: k.volume
    }));
    const ma5ForChart = data.ma5.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null);
    const ma20ForChart = data.ma20.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null);

    // 准备其他指标数据（用于图表展示）
    const rsiForChart = data.rsi.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null);
    const macdForChart = data.macdLine.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(4)) : null);
    const signalForChart = data.signalLine.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(4)) : null);
    const bollUpperForChart = data.bollUpper.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null);
    const bollLowerForChart = data.bollLower.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null);

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
      ma5: ma5ForChart,
      ma20: ma20ForChart,
      rsi: rsiForChart,
      macd: macdForChart,
      signal: signalForChart,
      boll_upper: bollUpperForChart,
      boll_lower: bollLowerForChart,
      total_trades: sellTrades.length,
      profit_trades: winTrades.length,
      loss_trades: sellTrades.length - winTrades.length,
      win_rate: winRate
    });

    res.json({ code: 0, data: result.toJSON() });
  } catch (e) {
    console.error('回测失败:', e.message, e.stack);
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 其他API保持不变
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

exports.getResults = async (req, res) => {
  try {
    const results = await BacktestResult.findAll({
      attributes: { exclude: ['kline_data', 'buy_points', 'sell_points', 'ma5', 'ma20', 'rsi', 'macd', 'signal', 'boll_upper', 'boll_lower', 'equity_curve'] },
      order: [['created_at', 'DESC']]
    });
    res.json({ code: 0, data: results });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
};

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