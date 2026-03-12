const { BacktestConfig, BacktestResult, StockPrediction, BacktestStrategy } = require('../models');
const DataService = require('../services/DataService');
const Strategy = require('../strategies');
const { calculateAllIndicators } = require('../strategies/indicators');

// 策略信号计算统一使用策略模块
const calculateStrategySignal = (strategyType, data, index, params) => {
  return Strategy.calculateSignal(strategyType, data, index, params);
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
    
    // 使用策略模块预计算所有指标
    const indicatorParams = {
      short_period, long_period, rsi_period,
      fast_period, slow_period, signal_period,
      boll_period, std_dev, breakout_period
    };
    const data = calculateAllIndicators(prices, indicatorParams);

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