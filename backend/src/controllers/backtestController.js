const { BacktestConfig, BacktestResult, StockPrediction, BacktestStrategy } = require('../models');
const DataService = require('../services/DataService');

// 辅助函数：计算简单均线
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

// 执行回测
exports.runBacktest = async (req, res) => {
  try {
    const { 
      stock_code, stock_name, start_date, end_date, 
      initial_capital = 100000, strategy_type = 'ma', strategy_id,
      params = {}
    } = req.body;

    const {
      short_period = 5, long_period = 20,
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

    // 计算均线
    const prices = klineData.map(k => k.close);
    const ma5 = calcMA(prices, 5);
    const ma20 = calcMA(prices, 20);

    // 回测
    let capital = initial_capital;
    let totalShares = 0;
    let inPosition = false;
    let avgCost = 0;
    let lastBuyShares = 0;
    const trades = [];

    for (let i = 1; i < klineData.length; i++) {
      const date = klineData[i].date;
      const price = klineData[i].close;
      
      let shouldBuy = false;
      let shouldSell = false;

      // 均线金叉死叉逻辑
      const ma5Prev = ma5[i-1], ma5Curr = ma5[i];
      const ma20Prev = ma20[i-1], ma20Curr = ma20[i];

      if (ma5Prev && ma20Prev && ma5Curr && ma20Curr) {
        if (!inPosition && ma5Prev <= ma20Prev && ma5Curr > ma20Curr) {
          shouldBuy = true;
        }
        if (inPosition && ma5Prev >= ma20Prev && ma5Curr < ma20Curr) {
          shouldSell = true;
        }
      }

      // 止盈止损
      if (inPosition && avgCost > 0) {
        const pct = (price - avgCost) / avgCost * 100;
        if (pct >= take_profit_pct * 100 || pct <= -stop_loss_pct * 100) {
          shouldSell = true;
        }
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
            account_balance: parseFloat(capital.toFixed(2))
          });
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
            sell_reason: '信号触发'
          });
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

    const result = await BacktestResult.create({
      stock_code, stock_name, start_date, end_date,
      initial_capital, final_capital: finalCapital,
      total_return: totalReturn,
      strategy_id, strategy_params_json: params,
      trades_json: trades,
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
      attributes: { exclude: ['kline_data', 'buy_points', 'sell_points', 'ma5', 'ma20', 'equity_curve'] },
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