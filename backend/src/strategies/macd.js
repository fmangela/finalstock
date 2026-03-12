/**
 * MACD (指数平滑异同移动平均线) 策略
 */

const name = 'macd';
const displayName = 'MACD策略';
const description = 'MACD金叉买入，死叉卖出';

const getDefaultParams = () => ({
  fast_period: 12,
  slow_period: 26,
  signal_period: 9
});

const calculateSignal = (data, index, params) => {
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

module.exports = {
  name,
  displayName,
  description,
  getDefaultParams,
  calculateSignal
};