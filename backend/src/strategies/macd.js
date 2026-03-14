/**
 * MACD 指数平滑异同移动平均线策略
 * 信号逻辑：
 *   买入：MACD 线从下方穿越信号线（金叉）
 *   卖出：MACD 线从上方穿越信号线（死叉）
 * 默认参数：快线 12 / 慢线 26 / 信号线 9
 */

const name = 'macd';
const displayName = 'MACD策略';
const description = 'MACD金叉买入，死叉卖出';

const getDefaultParams = () => ({
  fast_period: 12,    // 快速 EMA 周期
  slow_period: 26,    // 慢速 EMA 周期
  signal_period: 9    // 信号线 EMA 周期
});

const calculateSignal = (data, index, params) => {
  // 取当日和前一日的 MACD 线与信号线
  const macdLine     = data.macdLine[index];
  const macdLinePrev = data.macdLine[index - 1];
  const signalLine     = data.signalLine[index];
  const signalLinePrev = data.signalLine[index - 1];

  // 任一值为 null 时数据不足，不产生信号
  if (macdLine === null || macdLinePrev === null || signalLine === null || signalLinePrev === null) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }

  // 金叉：前一日 MACD ≤ 信号线，当日 MACD > 信号线（向上穿越）
  if (macdLinePrev <= signalLinePrev && macdLine > signalLine) {
    return { shouldBuy: true, shouldSell: false, reason: 'MACD金叉' };
  }

  // 死叉：前一日 MACD ≥ 信号线，当日 MACD < 信号线（向下穿越）
  if (macdLinePrev >= signalLinePrev && macdLine < signalLine) {
    return { shouldBuy: false, shouldSell: true, reason: 'MACD死叉' };
  }

  return { shouldBuy: false, shouldSell: false, reason: '' };
};

module.exports = { name, displayName, description, getDefaultParams, calculateSignal };
