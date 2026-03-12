const { BacktestConfig, BacktestResult, StockPrediction, BacktestStrategy } = require('../models');
const DataService = require('../services/DataService');

// 辅助函数：计算均线
const calculateMA = (data, period) => {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      result.push(sum / period);
    }
  }
  return result;
};

// 辅助函数：计算RSI
const calculateRSI = (data, period = 14) => {
  const result = [];
  const gains = [];
  const losses = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(null);
      continue;
    }
    const change = data[i].close - data[i-1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
    
    if (i < period) {
      result.push(null);
      continue;
    }
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }
  return result;
};

// 辅助函数：计算MACD
const calculateMACD = (data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  const ema = (arr, period) => {
    const result = [];
    const multiplier = 2 / (period + 1);
    for (let i = 0; i < arr.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else if (i === period - 1) {
        const sum = arr.slice(0, period).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      } else {
        const prev = result[i - 1];
        result.push((arr[i] - prev) * multiplier + prev);
      }
    }
    return result;
  };

  const closes = data.map(d => d.close);
  const fastEMA = ema(closes, fastPeriod);
  const slowEMA = ema(closes, slowPeriod);
  
  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }
  
  const signalLine = ema(macdLine.filter(v => v !== null), signalPeriod);
  const histogram = [];
  
  let signalIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      histogram.push(null);
    } else {
      const signalVal = signalLine[signalIdx];
      if (signalVal === null) {
        histogram.push(null);
      } else {
        histogram.push(macdLine[i] - signalVal);
        signalIdx++;
      }
    }
  }
  
  return { macdLine, signalLine, histogram };
};

// 辅助函数：计算布林带
const calculateBOLL = (data, period = 20, stdDev = 2) => {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ upper: null, middle: null, lower: null });
    } else {
      const closes = data.slice(i - period + 1, i + 1).map(d => d.close);
      const ma = closes.reduce((a, b) => a + b, 0) / period;
      const variance = closes.reduce((sum, val) => sum + Math.pow(val - ma, 2), 0) / period;
      const sd = Math.sqrt(variance);
      result.push({
        upper: ma + stdDev * sd,
        middle: ma,
        lower: ma - stdDev * sd
      });
    }
  }
  return result;
};

// 执行回测
exports.runBacktest = async (req, res) => {
  try {
    const { 
      stock_code, 
      stock_name, 
      start_date, 
      end_date, 
      initial_capital = 100000, 
      config_id,
      strategy_type = 'ma',  // 策略类型
      strategy_id,           // 策略ID
      strategy_instance_id,  // 策略实例ID
      params = {}            // 策略参数
    } = req.body;

    // 解析策略参数
    const {
      short_period = 5,
      long_period = 20,
      period: rsi_period = 14,
      oversold = 30,
      overbought = 70,
      fast_period = 12,
      slow_period = 26,
      signal_period = 9,
      boll_period = 20,
      std_dev = 2,
      breakout_period = 20,
      stop_loss_pct = 0.05,
      take_profit_pct = 0.15
    } = params;

    // 使用新浪API获取股票历史数据
    const SinaStockAPI = require('../services/providers/SinaStockProvider');
    let allData = [];
    try {
      allData = await SinaStockAPI.getKline(stock_code, start_date, end_date);
    } catch (e) {
      console.error('获取股票数据失败:', e.message);
    }

    if (!allData || allData.length === 0) {
      try {
        allData = await DataService.getStockHistory(stock_code, 'daily', 500);
      } catch (e) {}
    }

    if (!allData || allData.length === 0) {
      return res.json({ code: 1, message: '无法获取股票数据，请稍后重试' });
    }

    // 按日期排序
    allData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 计算需要向前扩展的天数（用于计算指标）
    const maxPreDays = Math.max(long_period, rsi_period, slow_period, boll_period, breakout_period) + 30;
    const startDateObj = new Date(start_date);
    startDateObj.setDate(startDateObj.getDate() - maxPreDays);
    const filterStartDate = startDateObj.toISOString().slice(0, 10);
    
    // 过滤日期范围（包含用于计算指标的扩展数据）
    const klineData = allData.filter(d => d.date >= filterStartDate && d.date <= end_date);
    
    // 找到回测实际开始日期在数据中的索引
    const actualStartIndex = klineData.findIndex(d => d.date >= start_date);
    const tradeStartIndex = actualStartIndex >= 0 ? actualStartIndex : 0;
    
    if (klineData.length - tradeStartIndex < 10) {
      return res.json({ code: 1, message: '数据量不足，无法进行回测' });
    }

    // 初始化资金和持仓
    let capital = parseFloat(initial_capital);
    let shares = 0;
    let inPosition = false;
    let avgCost = 0;

    const trades = [];
    const equityCurve = [];

    // 回测交易逻辑（只从回测开始日期计算）
    for (let i = tradeStartIndex + 1; i < klineData.length; i++) {
      const date = klineData[i].date;
      const price = klineData[i].close;
      const currentValue = capital + shares * price;
      equityCurve.push({ date, value: parseFloat(currentValue.toFixed(2)) });

      let shouldBuy = false;
      let shouldSell = false;

      // 根据策略类型计算信号
      if (strategy_type === 'ma' || strategy_type === 'ma_cross') {
        // 均线交叉策略
        const maShort = calculateMA(klineData, short_period);
        const maLong = calculateMA(klineData, long_period);
        const maShortPrev = maShort[i - 1];
        const maShortCurr = maShort[i];
        const maLongPrev = maLong[i - 1];
        const maLongCurr = maLong[i];

        if (!inPosition && maShortPrev && maLongPrev && maShortCurr && maLongCurr) {
          if (maShortPrev <= maLongPrev && maShortCurr > maLongCurr) {
            shouldBuy = true;
          }
        }
        if (inPosition && maShortPrev && maLongPrev && maShortCurr && maLongCurr) {
          if (maShortPrev >= maLongPrev && maShortCurr < maLongCurr) {
            shouldSell = true;
          }
        }
      } else if (strategy_type === 'rsi') {
        // RSI超买超卖策略
        const rsi = calculateRSI(klineData, rsi_period);
        const rsiCurr = rsi[i];
        const rsiPrev = rsi[i - 1];

        if (!inPosition && rsiCurr && rsiPrev) {
          if (rsiPrev < oversold && rsiCurr >= oversold) {
            shouldBuy = true;
          }
        }
        if (inPosition && rsiCurr && rsiPrev) {
          if (rsiPrev > overbought && rsiCurr <= overbought) {
            shouldSell = true;
          }
        }
      } else if (strategy_type === 'macd') {
        // MACD金叉死叉策略
        const { macdLine, signalLine } = calculateMACD(klineData, fast_period, slow_period, signal_period);
        const macdPrev = macdLine[i - 1];
        const macdCurr = macdLine[i];
        const signalPrev = signalLine[i - 1];
        const signalCurr = signalLine[i];

        if (!inPosition && macdPrev && signalPrev && macdCurr && signalCurr) {
          if (macdPrev <= signalPrev && macdCurr > signalCurr) {
            shouldBuy = true;
          }
        }
        if (inPosition && macdPrev && signalPrev && macdCurr && signalCurr) {
          if (macdPrev >= signalPrev && macdCurr < signalCurr) {
            shouldSell = true;
          }
        }
      } else if (strategy_type === 'boll') {
        // 布林带策略
        const boll = calculateBOLL(klineData, boll_period, stdDev);
        const bollCurr = boll[i];
        const bollPrev = boll[i - 1];

        if (!inPosition && bollCurr && bollPrev) {
          if (price <= bollCurr.lower && price > bollPrev.lower) {
            shouldBuy = true;
          }
        }
        if (inPosition && bollCurr && bollPrev) {
          if (price >= bollCurr.upper && price < bollPrev.upper) {
            shouldSell = true;
          }
        }
      } else if (strategy_type === 'breakout') {
        // 突破策略
        const highs = klineData.slice(Math.max(0, i - breakout_period), i).map(d => d.high);
        const lows = klineData.slice(Math.max(0, i - breakout_period), i).map(d => d.low);
        const highest = highs.length > 0 ? Math.max(...highs) : 0;
        const lowest = lows.length > 0 ? Math.min(...lows) : 0;

        if (!inPosition && price > highest && highest > 0) {
          shouldBuy = true;
        }
        if (inPosition && price < lowest && lowest > 0) {
          shouldSell = true;
        }
      } else {
        // 默认：均线交叉策略
        const maShort = calculateMA(klineData, 5);
        const maLong = calculateMA(klineData, 20);
        const maShortPrev = maShort[i - 1];
        const maShortCurr = maShort[i];
        const maLongPrev = maLong[i - 1];
        const maLongCurr = maLong[i];

        if (!inPosition && maShortPrev && maLongPrev && maShortCurr && maLongCurr) {
          if (maShortPrev <= maLongPrev && maShortCurr > maLongCurr) {
            shouldBuy = true;
          }
        }
        if (inPosition && maShortPrev && maLongPrev && maShortCurr && maLongCurr) {
          if (maShortPrev >= maLongPrev && maShortCurr < maLongCurr) {
            shouldSell = true;
          }
        }
      }

      // 止盈止损检查
      if (inPosition) {
        const priceChange = (price - avgCost) / avgCost;
        if (priceChange >= take_profit_pct || priceChange <= -stop_loss_pct) {
          shouldSell = true;
        }
      }

      // 执行买入
      if (shouldBuy && !inPosition) {
        const buyAmount = capital * 0.95;
        const newShares = Math.floor(buyAmount / price);
        if (newShares > 0) {
          const cost = newShares * price;
          capital -= cost;
          avgCost = price;
          inPosition = true;
          trades.push({
            date, type: 'buy', price: parseFloat(price.toFixed(2)),
            shares: newShares, amount: parseFloat(cost.toFixed(2))
          });
        }
      }

      // 执行卖出
      if (shouldSell && inPosition) {
        const sellAmount = shares * price;
        const profit = sellAmount - (shares * avgCost);
        capital += sellAmount;
        trades.push({
          date, type: 'sell', price: parseFloat(price.toFixed(2)),
          shares, amount: parseFloat(sellAmount.toFixed(2)),
          profit: parseFloat(profit.toFixed(2))
        });
        shares = 0;
        inPosition = false;
        avgCost = 0;
      }
    }

    // 最后一天如果还有持仓，按收盘价卖出（只在该日期在回测范围内时）
    if (inPosition && klineData.length > 0) {
      const lastData = klineData[klineData.length - 1];
      // 检查是否在回测期间内（只在回测期间最后一天平仓）
      if (lastData.date <= end_date) {
        const sellAmount = shares * lastData.close;
        const profit = sellAmount - (shares * avgCost);
        capital += sellAmount;
        trades.push({
          date: lastData.date, type: 'sell', price: parseFloat(lastData.close.toFixed(2)),
          shares, amount: parseFloat(sellAmount.toFixed(2)),
          profit: parseFloat(profit.toFixed(2))
        });
      }
    }

    // 只保留回测日期范围内的equityCurve
    const filteredEquityCurve = equityCurve.filter(p => p.date >= start_date && p.date <= end_date);
    // 添加初始资金点
    if (filteredEquityCurve.length > 0 && filteredEquityCurve[0].date !== start_date) {
      filteredEquityCurve.unshift({ date: start_date, value: initial_capital });
    }

    // 计算指标
    const finalCapital = capital;
    const totalReturn = initial_capital > 0 ? ((finalCapital - initial_capital) / initial_capital) : 0;
    const days = klineData.length;
    const years = days / 250;
    const annualReturn = years > 0 ? (Math.pow(1 + totalReturn, 1 / years) - 1) : 0;

    let maxDrawdown = 0;
    let peak = 0;
    filteredEquityCurve.forEach(point => {
      if (point.value > peak) peak = point.value;
      const drawdown = peak > 0 ? (peak - point.value) / peak : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    const sellTrades = trades.filter(t => t.type === 'sell');
    const totalTrades = sellTrades.length;
    const profitTrades = sellTrades.filter(t => t.profit > 0).length;
    const lossTrades = sellTrades.filter(t => t.profit <= 0).length;
    const winRate = totalTrades > 0 ? profitTrades / totalTrades : 0;

    const returns = [];
    for (let i = 1; i < filteredEquityCurve.length; i++) {
      const prevVal = filteredEquityCurve[i-1].value;
      if (prevVal > 0) {
        returns.push((filteredEquityCurve[i].value - prevVal) / prevVal);
      }
    }
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdReturn = Math.sqrt(returns.length > 0 ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0);
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(250) : 0;

    // 准备图表数据
    const klineForChart = klineData.filter(k => k.date >= start_date && k.date <= end_date)
      .map(k => ({ date: k.date, open: k.open, close: k.close, high: k.high, low: k.low, volume: k.volume }));
    
    const klineMa5 = calculateMA(klineData, 5);
    const klineMa20 = calculateMA(klineData, 20);
    const buyPoints = trades.filter(t => t.type === 'buy').map(t => ({ date: t.date, price: t.price }));
    const sellPoints = trades.filter(t => t.type === 'sell').map(t => ({ date: t.date, price: t.price, profit: t.profit }));

    // 保存回测结果
    const result = await BacktestResult.create({
      config_id: config_id || null,
      stock_code,
      stock_name,
      start_date,
      end_date,
      initial_capital,
      final_capital: finalCapital,
      total_return: totalReturn * 100,
      annual_return: annualReturn * 100,
      max_drawdown: maxDrawdown * 100,
      win_rate: winRate * 100,
      total_trades: totalTrades,
      profit_trades: profitTrades,
      loss_trades: lossTrades,
      sharpe_ratio: sharpeRatio,
      trades_json: trades,
      equity_curve: filteredEquityCurve,
      kline_data: klineForChart,
      buy_points: buyPoints.filter(b => b.date >= start_date && b.date <= end_date),
      sell_points: sellPoints.filter(s => s.date >= start_date && s.date <= end_date),
      ma5: klineMa5.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null),
      ma20: klineMa20.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null),
      // 策略信息
      strategy_id: strategy_id || null,
      strategy_instance_id: strategy_instance_id || null,
      strategy_params_json: params
    });

    res.json({ code: 0, data: result.toJSON() });
  } catch (e) {
    console.error('回测执行失败:', e);
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 获取回测配置列表
exports.getConfigs = async (req, res) => {
  try {
    const configs = await BacktestConfig.findAll({ order: [['created_at', 'DESC']] });
    res.json({ code: 0, data: configs });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 创建回测配置
exports.createConfig = async (req, res) => {
  try {
    const { name, stock_code, stock_name, start_date, end_date, initial_capital, buy_strategy, sell_strategy, params } = req.body;
    const config = await BacktestConfig.create({ name, stock_code, stock_name, start_date, end_date, initial_capital, buy_strategy, sell_strategy, params });
    res.json({ code: 0, data: config });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 更新回测配置
exports.updateConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const config = await BacktestConfig.findByPk(id);
    if (!config) return res.status(404).json({ code: 404, message: '配置不存在' });
    const { name, stock_code, stock_name, start_date, end_date, initial_capital, buy_strategy, sell_strategy, params } = req.body;
    await config.update({ name, stock_code, stock_name, start_date, end_date, initial_capital, buy_strategy, sell_strategy, params });
    res.json({ code: 0, data: config });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 删除回测配置
exports.deleteConfig = async (req, res) => {
  try {
    const { id } = req.params;
    await BacktestConfig.destroy({ where: { id } });
    await BacktestResult.destroy({ where: { config_id: id } });
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 获取回测结果列表
exports.getResults = async (req, res) => {
  try {
    const { stock_code } = req.query;
    const where = stock_code ? { stock_code } : {};
    const results = await BacktestResult.findAll({ 
      where, 
      attributes: { exclude: ['kline_data', 'buy_points', 'sell_points', 'ma5', 'ma20', 'equity_curve'] },
      order: [['created_at', 'DESC']] 
    });
    res.json({ code: 0, data: results });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 获取单条回测结果
exports.getResult = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await BacktestResult.findByPk(id);
    if (!result) return res.status(404).json({ code: 404, message: '回测结果不存在' });
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 删除回测结果
exports.deleteResult = async (req, res) => {
  try {
    const { id } = req.params;
    await BacktestResult.destroy({ where: { id } });
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 获取可回测的股票列表
exports.getBacktestStocks = async (req, res) => {
  try {
    const stocks = await StockPrediction.findAll({
      where: { status: 'active' },
      attributes: ['stock_code', 'stock_name'],
      group: ['stock_code', 'stock_name']
    });
    res.json({ code: 0, data: stocks });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};
