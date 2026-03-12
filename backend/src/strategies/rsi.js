/**
 * RSI (相对强弱指标) 策略
 */

const name = 'rsi';
const displayName = 'RSI相对强弱';
const description = 'RSI低于超卖阈值买入，高于超买阈值卖出';

const getDefaultParams = () => ({
  rsi_period: 14,
  oversold: 30,
  overbought: 70
});

const calculateSignal = (data, index, params) => {
  const { rsi_period = 14, oversold = 30, overbought = 70 } = params;
  const rsi = data.rsi[index];
  
  if (rsi === null || rsi === undefined) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }
  
  if (rsi < oversold) {
    return { shouldBuy: true, shouldSell: false, reason: `RSI超卖(${rsi.toFixed(1)}<${oversold})` };
  }
  if (rsi > overbought) {
    return { shouldBuy: false, shouldSell: true, reason: `RSI超买(${rsi.toFixed(1)}>${overbought})` };
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