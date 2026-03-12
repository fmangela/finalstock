const { BacktestConfig, BacktestResult, StockPrediction } = require('../models');
const DataService = require('../services/DataService');

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
    // 同时删除关联的回测结果
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
    const results = await BacktestResult.findAll({ where, order: [['created_at', 'DESC']] });
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

// 获取可回测的股票列表（从LLM选股中获取正常状态的股票）
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
      // 策略参数
      ma_short = 5,
      ma_long = 20,
      stop_loss_pct = 0.05,
      take_profit_pct = 0.15
    } = req.body;

    // 使用新浪API获取股票历史数据
    const SinaStockAPI = require('../services/providers/SinaStockProvider');
    let allData = [];
    try {
      allData = await SinaStockAPI.getKline(stock_code, start_date, end_date);
    } catch (e) {
      console.error('获取股票数据失败:', e.message);
    }

    if (!allData || allData.length === 0) {
      // 尝试使用AKShare作为备用
      try {
        allData = await DataService.getStockHistory(stock_code, 'daily', 500);
      } catch (e) {}
    }

    if (!allData || allData.length === 0) {
      return res.json({ code: 1, message: '无法获取股票数据，请稍后重试' });
    }

    // 按日期排序
    allData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 计算需要向前扩展的天数（用于均线计算）
    const preDays = ma_long + 20;
    const startDateObj = new Date(start_date);
    startDateObj.setDate(startDateObj.getDate() - preDays);
    const filterStartDate = startDateObj.toISOString().slice(0, 10);
    
    // 过滤日期范围
    const klineData = allData.filter(d => d.date >= filterStartDate && d.date <= end_date);
    
    if (klineData.length < ma_long + 10) {
      return res.json({ code: 1, message: '数据量不足，无法进行回测' });
    }

    // 计算均线
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

    const closePrices = klineData.map(d => d.close);
    const ma5 = calculateMA(klineData, ma_short);
    const ma20 = calculateMA(klineData, ma_long);

    // 初始化资金和持仓
    let capital = parseFloat(initial_capital);
    let shares = 0;
    let inPosition = false;
    let avgCost = 0;

    const trades = [];
    const equityCurve = [];

    // 回测交易逻辑：均线金叉买入，死叉卖出
    for (let i = 1; i < klineData.length; i++) {
      const date = klineData[i].date;
      const price = klineData[i].close;
      const ma5Prev = ma5[i - 1];
      const ma5Curr = ma5[i];
      const ma20Prev = ma20[i - 1];
      const ma20Curr = ma20[i];

      // 记录当前权益
      const currentValue = capital + shares * price;
      equityCurve.push({ date, value: parseFloat(currentValue.toFixed(2)) });

      // 买入信号：MA5上穿MA20，且当前没有持仓
      if (!inPosition && ma5Prev && ma20Prev && ma5Curr && ma20Curr) {
        if (ma5Prev <= ma20Prev && ma5Curr > ma20Curr) {
          // 买入
          const buyAmount = capital * 0.95; // 95%仓位
          shares = Math.floor(buyAmount / price);
          const cost = shares * price;
          if (shares > 0 && cost > 0) {
            capital -= cost;
            avgCost = price;
            inPosition = true;
            trades.push({
              date,
              type: 'buy',
              price: parseFloat(price.toFixed(2)),
              shares,
              amount: parseFloat(cost.toFixed(2))
            });
          }
        }
      }

      // 卖出信号：MA5下穿MA20，或达到止盈止损
      if (inPosition && ma5Prev && ma20Prev && ma5Curr && ma20Curr) {
        const priceChange = (price - avgCost) / avgCost;
        
        // 均线死叉 OR 止盈 OR 止损
        if (ma5Prev >= ma20Prev && ma5Curr < ma20Curr || priceChange >= take_profit_pct || priceChange <= -stop_loss_pct) {
          const sellAmount = shares * price;
          capital += sellAmount;
          const profit = sellAmount - (shares * avgCost);
          trades.push({
            date,
            type: 'sell',
            price: parseFloat(price.toFixed(2)),
            shares,
            amount: parseFloat(sellAmount.toFixed(2)),
            profit: parseFloat(profit.toFixed(2))
          });
          shares = 0;
          inPosition = false;
          avgCost = 0;
        }
      }
    }

    // 最后一天如果还有持仓，按收盘价卖出
    if (inPosition && klineData.length > 0) {
      const lastData = klineData[klineData.length - 1];
      const sellAmount = shares * lastData.close;
      capital += sellAmount;
      const profit = sellAmount - (shares * avgCost);
      trades.push({
        date: lastData.date,
        type: 'sell',
        price: parseFloat(lastData.close.toFixed(2)),
        shares,
        amount: parseFloat(sellAmount.toFixed(2)),
        profit: parseFloat(profit.toFixed(2))
      });
    }

    // 计算各项指标
    const finalCapital = capital;
    const totalReturn = (finalCapital - initial_capital) / initial_capital;
    const days = klineData.length;
    const years = days / 250;
    const annualReturn = Math.pow(1 + totalReturn, 1 / years) - 1;

    // 计算最大回撤
    let maxDrawdown = 0;
    let peak = 0;
    equityCurve.forEach(point => {
      if (point.value > peak) peak = point.value;
      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    // 统计交易
    const sellTrades = trades.filter(t => t.type === 'sell');
    const totalTrades = sellTrades.length;
    const profitTrades = sellTrades.filter(t => t.profit > 0).length;
    const lossTrades = sellTrades.filter(t => t.profit <= 0).length;
    const winRate = totalTrades > 0 ? profitTrades / totalTrades : 0;

    // 计算夏普比率（简化版）
    const returns = [];
    for (let i = 1; i < equityCurve.length; i++) {
      returns.push((equityCurve[i].value - equityCurve[i-1].value) / equityCurve[i-1].value);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(250) : 0;

    // 计算月度收益
    const monthlyMap = {};
    equityCurve.forEach(point => {
      const month = point.date.substring(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = [];
      monthlyMap[month].push(point.value);
    });
    const monthlyReturns = Object.entries(monthlyMap).map(([month, values]) => {
      const startVal = values[0];
      const endVal = values[values.length - 1];
      return { month, return: parseFloat(((endVal - startVal) / startVal * 100).toFixed(2)) };
    });

    // 准备K线数据用于前端绑图（只保留回测日期范围内的数据）
    const klineForChart = klineData
      .filter(k => k.date >= start_date && k.date <= end_date)
      .map(k => ({
        date: k.date,
        open: k.open,
        close: k.close,
        high: k.high,
        low: k.low,
        volume: k.volume
      }));

    console.log('klineForChart.length:', klineForChart.length, 'start_date:', start_date, 'end_date:', end_date);
    console.log('klineData first:', klineData[0]?.date, 'last:', klineData[klineData.length-1]?.date);

    // 计算均线用于图表
    const klineClosePrices = klineData.map(k => k.close);
    const klineMa5 = calculateMA(klineData, 5);
    const klineMa20 = calculateMA(klineData, 20);

    // 标记买卖点
    const buyPoints = trades.filter(t => t.type === 'buy').map(t => ({
      date: t.date,
      price: t.price
    }));
    const sellPoints = trades.filter(t => t.type === 'sell').map(t => ({
      date: t.date,
      price: t.price,
      profit: t.profit
    }));

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
      equity_curve: equityCurve,
      monthly_returns: monthlyReturns,
      // 图表数据
      kline_data: klineForChart,
      buy_points: buyPoints,
      sell_points: sellPoints,
      ma5: klineMa5.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null),
      ma20: klineMa20.slice(-klineForChart.length).map(v => v ? parseFloat(v.toFixed(2)) : null)
    });

    // 构建返回数据
    const responseData = result.toJSON();

    res.json({ code: 0, data: responseData });
  } catch (e) {
    console.error('回测执行失败:', e);
    res.status(500).json({ code: 500, message: e.message });
  }
};