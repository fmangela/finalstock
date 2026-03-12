/**
 * 技术指标计算工具
 * 所有策略共用的指标计算函数
 */

// 简单移动平均
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
  
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }
  }
  
  const validMacd = macdLine.filter(v => v !== null);
  const validSignal = calculateEMA(validMacd, signalPeriod);
  
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

/**
 * 预计算所有指标数据
 * @param {Array} prices - 价格数组
 * @param {Object} params - 策略参数
 * @returns {Object} 包含所有指标的data对象
 */
const calculateAllIndicators = (prices, params) => {
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

  // MACD
  const macdResult = calculateMACD(prices, fast_period, slow_period, signal_period);
  data.macdLine = macdResult.macdLine;
  data.signalLine = macdResult.signalLine;
  data.histogram = macdResult.histogram;

  // BOLL
  const bollResult = calculateBOLL(prices, boll_period, std_dev);
  data.bollUpper = bollResult.upper;
  data.bollMiddle = bollResult.middle;
  data.bollLower = bollResult.lower;

  // Breakout
  const breakoutResult = calculateBreakout(prices, breakout_period);
  data.breakoutHighs = breakoutResult.highs;
  data.breakoutLows = breakoutResult.lows;

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