/**
 * BOLL (布林带) 策略
 */

const name = 'boll';
const displayName = 'BOLL布林带';
const description = '价格突破布林带上轨买入，跌破下轨卖出';

const getDefaultParams = () => ({
  boll_period: 20,
  std_dev: 2
});

const calculateSignal = (data, index, params) => {
  const { boll_period = 20, std_dev = 2 } = params;
  const price = data.prices[index];
  const upper = data.bollUpper[index];
  const lower = data.bollLower[index];
  
  if (upper === null || lower === null) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }
  
  // 突破上轨买入（超买）
  if (price > upper) {
    return { shouldBuy: true, shouldSell: false, reason: `BOLL突破上轨(${price.toFixed(2)}>${upper.toFixed(2)})` };
  }
  
  // 跌破下轨卖出（超卖）
  if (price < lower) {
    return { shouldBuy: false, shouldSell: true, reason: `BOLL跌破下轨(${price.toFixed(2)}<${lower.toFixed(2)})` };
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