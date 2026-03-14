// 技术指标单元测试
// 验证各指标函数的边界行为：数据不足时返回 null，有效值在合理范围内
const { calcMA, calculateRSI, calculateMACD, calculateBOLL, calculateBreakout, calculateAllIndicators } = require('../src/strategies/indicators');

// 30 个价格点，足够覆盖大多数指标的最小数据量要求
const prices = [10,11,12,11,10,9,10,11,12,13,14,13,12,11,10,11,12,13,14,15,16,15,14,13,12,11,10,11,12,13];

describe('calcMA', () => {
  test('数据不足时前 period-1 个位置返回 null', () => {
    const result = calcMA(prices, 5);
    expect(result[0]).toBeNull();
    expect(result[3]).toBeNull();
  });

  test('在 period 边界处计算正确', () => {
    const result = calcMA([1,2,3,4,5], 3);
    expect(result[2]).toBeCloseTo(2); // (1+2+3)/3 = 2
    expect(result[4]).toBeCloseTo(4); // (3+4+5)/3 = 4
  });
});

describe('calculateRSI', () => {
  test('前 period 个位置返回 null（数据不足）', () => {
    const result = calculateRSI(prices, 14);
    expect(result[0]).toBeNull();
    expect(result[13]).toBeNull();
  });

  test('有效 RSI 值在 0~100 范围内', () => {
    const result = calculateRSI(prices, 14);
    const valid = result.filter(v => v !== null);
    valid.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe('calculateMACD', () => {
  test('返回 macdLine / signalLine / histogram 三个数组', () => {
    const result = calculateMACD(prices, 3, 6, 2);
    expect(result).toHaveProperty('macdLine');
    expect(result).toHaveProperty('signalLine');
    expect(result).toHaveProperty('histogram');
    expect(result.macdLine).toHaveLength(prices.length);
  });
});

describe('calculateBOLL', () => {
  test('返回 middle / upper / lower 三条轨道', () => {
    const result = calculateBOLL(prices, 5, 2);
    expect(result).toHaveProperty('middle');
    expect(result).toHaveProperty('upper');
    expect(result).toHaveProperty('lower');
  });

  test('有效位置满足 upper > middle > lower', () => {
    const result = calculateBOLL(prices, 5, 2);
    for (let i = 4; i < prices.length; i++) {
      expect(result.upper[i]).toBeGreaterThan(result.middle[i]);
      expect(result.middle[i]).toBeGreaterThan(result.lower[i]);
    }
  });
});

describe('calculateBreakout', () => {
  test('返回 highs 和 lows 两个数组', () => {
    const result = calculateBreakout(prices, 5);
    expect(result.highs).toHaveLength(prices.length);
    expect(result.lows).toHaveLength(prices.length);
  });

  test('有效位置满足 high >= low', () => {
    const result = calculateBreakout(prices, 5);
    for (let i = 4; i < prices.length; i++) {
      expect(result.highs[i]).toBeGreaterThanOrEqual(result.lows[i]);
    }
  });
});

describe('calculateAllIndicators', () => {
  test('返回所有策略所需的指标字段', () => {
    const result = calculateAllIndicators(prices, {
      short_period: 5, long_period: 10, rsi_period: 7,
      fast_period: 3, slow_period: 6, signal_period: 2,
      boll_period: 5, std_dev: 2, breakout_period: 5
    });
    ['prices','ma5','ma20','rsi','macdLine','signalLine','bollUpper','bollLower','breakoutHighs','breakoutLows'].forEach(k => {
      expect(result).toHaveProperty(k);
    });
  });
});
