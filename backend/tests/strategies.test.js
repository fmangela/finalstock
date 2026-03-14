// 策略信号单元测试
// 验证所有 5 种策略的信号形状、互斥性，以及策略注册表的完整性
const { calculateAllIndicators } = require('../src/strategies/indicators');
const Strategy = require('../src/strategies');

// 生成 60 个带正弦波动的模拟价格，覆盖各指标的最小数据量要求
const makePrices = (n) => {
  const p = [];
  for (let i = 0; i < n; i++) p.push(10 + Math.sin(i * 0.3) * 3 + i * 0.05);
  return p;
};

const prices = makePrices(60);
const params = {
  short_period: 5, long_period: 20, rsi_period: 14,
  fast_period: 12, slow_period: 26, signal_period: 9,
  boll_period: 20, std_dev: 2, breakout_period: 20
};
// 预计算所有指标，供各策略测试复用
const data = calculateAllIndicators(prices, params);

describe('Strategy.calculateSignal', () => {
  test('未知策略名称应抛出异常', () => {
    expect(() => Strategy.calculateSignal('unknown', data, 30, params)).toThrow();
  });

  ['ma', 'rsi', 'macd', 'boll', 'breakout'].forEach(name => {
    test(`${name} 返回包含 shouldBuy / shouldSell 的信号对象`, () => {
      const signal = Strategy.calculateSignal(name, data, 30, params);
      expect(signal).toHaveProperty('shouldBuy');
      expect(signal).toHaveProperty('shouldSell');
      expect(typeof signal.shouldBuy).toBe('boolean');
      expect(typeof signal.shouldSell).toBe('boolean');
    });

    test(`${name} 不会同时发出买入和卖出信号`, () => {
      for (let i = 1; i < prices.length; i++) {
        const s = Strategy.calculateSignal(name, data, i, params);
        // 买入和卖出互斥，不能同时为 true
        expect(s.shouldBuy && s.shouldSell).toBe(false);
      }
    });
  });
});

describe('Strategy.getStrategyList', () => {
  test('返回全部 5 种内置策略', () => {
    const list = Strategy.getStrategyList();
    const names = list.map(s => s.name);
    ['ma', 'rsi', 'macd', 'boll', 'breakout'].forEach(n => expect(names).toContain(n));
  });
});
