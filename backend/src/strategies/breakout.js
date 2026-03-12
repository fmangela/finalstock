/**
 * Breakout (突破) 策略
 */

const name = 'breakout';
const displayName = '突破策略';
const description = '突破N日高点买入，跌破N日低点卖出';

const getDefaultParams = () => ({
  breakout_period: 20
});

const calculateSignal = (data, index, params) => {
  const { breakout_period = 20 } = params;
  const price = data.prices[index];
  const highs = data.breakoutHighs[index];
  const lows = data.breakoutLows[index];
  
  if (highs === null || lows === null) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }
  
  // 突破N日高点
  if (price > highs) {
    return { shouldBuy: true, shouldSell: false, reason: `突破${breakout_period}日高点(${price.toFixed(2)}>${highs.toFixed(2)})` };
  }
  
  // 跌破N日低点
  if (price < lows) {
    return { shouldBuy: false, shouldSell: true, reason: `跌破${breakout_period}日低点(${price.toFixed(2)}<${lows.toFixed(2)})` };
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