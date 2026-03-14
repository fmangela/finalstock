/**
 * 技术指标计算工具
 * 所有策略共用的指标计算函数，输入收盘价数组，输出各指标数组
 * 数据不足时对应位置返回 null，策略层需判空后再使用
 */

// 简单移动平均（SMA）
// 前 period-1 个位置返回 null，从第 period 个位置开始有值
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

// 相对强弱指标（RSI）
// 计算方式：先求每日涨跌幅，再统计 period 内平均涨幅/跌幅，代入公式
// RSI = 100 - 100 / (1 + 平均涨幅 / 平均跌幅)
const calculateRSI = (prices, period = 14) => {
  const rsi = [];
  const changes = [];

  // 计算每日价格变化量
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      rsi.push(null); // 数据不足，无法计算
    } else {
      let gains = 0, losses = 0;
      // 统计 period 内的涨幅之和与跌幅之和
      for (let j = i - period + 1; j <= i; j++) {
        if (changes[j - 1] > 0) gains += changes[j - 1];
        else losses -= changes[j - 1]; // 取绝对值
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) {
        rsi.push(100); // 全部上涨，RSI 为 100
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
  }
  return rsi;
};

// 指数移动平均（EMA）
// 与 SMA 不同，EMA 对近期价格赋予更高权重
// 乘数 multiplier = 2 / (period + 1)
const calculateEMA = (prices, period) => {
  const ema = [];
  const multiplier = 2 / (period + 1);

  let sum = 0;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ema.push(null); // 数据不足
    } else if (i === period - 1) {
      // 第一个 EMA 值用简单平均初始化
      sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      ema.push(sum / period);
    } else {
      // 后续 EMA = (当日价格 - 前日EMA) × 乘数 + 前日EMA
      const prevEma = ema[i - 1];
      ema.push((prices[i] - prevEma) * multiplier + prevEma);
    }
  }
  return ema;
};

// MACD（指数平滑异同移动平均线）
// MACD线 = 快线EMA - 慢线EMA
// 信号线 = MACD线的EMA
// 柱状图 = MACD线 - 信号线
const calculateMACD = (prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);

  // 计算 MACD 线（快线 - 慢线），两者都有值时才计算
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }
  }

  // 对 MACD 线的有效值计算信号线（EMA）
  const validMacd = macdLine.filter(v => v !== null);
  const validSignal = calculateEMA(validMacd, signalPeriod);

  // 将信号线映射回原始长度（null 位置补 null）
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

  // 柱状图 = MACD线 - 信号线
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

// 布林带（BOLL）
// 中轨 = N日SMA；上轨 = 中轨 + k×标准差；下轨 = 中轨 - k×标准差
// 默认 N=20，k=2
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
      // 计算 N 日均值
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      const sma = sum / period;

      // 计算 N 日标准差
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

// 突破策略辅助：计算 N 日最高价和最低价
// 优先使用 K 线的真实最高/最低价（而非收盘价），更准确反映价格区间
const calculateBreakout = (prices, period = 20, klineData = null) => {
  const highs = [];
  const lows = [];

  // 有完整 K 线数据时使用真实高低价，否则退化为收盘价
  const useHL = klineData && klineData.length === prices.length;

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      highs.push(null);
      lows.push(null);
    } else {
      let maxPrice = useHL ? klineData[i].high : prices[i];
      let minPrice = useHL ? klineData[i].low : prices[i];
      // 向前回溯 period 天，取最高/最低
      for (let j = 1; j < period; j++) {
        const prevHigh = useHL ? klineData[i - j].high : prices[i - j];
        const prevLow  = useHL ? klineData[i - j].low  : prices[i - j];
        maxPrice = Math.max(maxPrice, prevHigh);
        minPrice = Math.min(minPrice, prevLow);
      }
      highs.push(maxPrice);
      lows.push(minPrice);
    }
  }

  return { highs, lows };
};

/**
 * 批量预计算所有策略所需指标
 * 在回测开始前一次性计算完毕，避免逐日重复计算，提升性能
 * @param {number[]} prices    - 收盘价数组
 * @param {Object}  params     - 各指标参数
 * @param {Array}   klineData  - 完整 K 线数据（用于突破策略的真实高低价）
 * @returns {Object} 包含所有指标序列的 data 对象
 */
const calculateAllIndicators = (prices, params, klineData = null) => {
  const {
    short_period = 5,
    long_period = 20,
    rsi_period = 14,
    fast_period = 12,
    slow_period = 26,
    signal_period = 9,
    boll_period = 20,
    std_dev = 2,
    breakout_period = 20
  } = params;

  const data = {
    prices,
    ma5:  calcMA(prices, short_period),   // 短期均线
    ma20: calcMA(prices, long_period),    // 长期均线
    rsi:  calculateRSI(prices, rsi_period),
    macdLine: [], signalLine: [], histogram: [],
    bollUpper: [], bollMiddle: [], bollLower: [],
    breakoutHighs: [], breakoutLows: []
  };

  // MACD 三线
  const macdResult = calculateMACD(prices, fast_period, slow_period, signal_period);
  data.macdLine   = macdResult.macdLine;
  data.signalLine = macdResult.signalLine;
  data.histogram  = macdResult.histogram;

  // 布林带三轨
  const bollResult = calculateBOLL(prices, boll_period, std_dev);
  data.bollUpper  = bollResult.upper;
  data.bollMiddle = bollResult.middle;
  data.bollLower  = bollResult.lower;

  // 突破策略高低点（传入 klineData 使用真实高低价）
  const breakoutResult = calculateBreakout(prices, breakout_period, klineData);
  data.breakoutHighs = breakoutResult.highs;
  data.breakoutLows  = breakoutResult.lows;

  return data;
};

module.exports = {
  calcMA,
  calculateRSI,
  calculateEMA,
  calculateMACD,
  calculateBOLL,
  calculateBreakout,
  calculateAllIndicators
};
