/**
 * MA (均线交叉) 策略
 */

const name = 'ma';
const displayName = 'MA均线交叉';
const description = '短期均线上穿长期均线买入，下穿卖出';

const getDefaultParams = () => ({
  short_period: 5,
  long_period: 20
});

const calculateSignal = (data, index, params) => {
  const { short_period = 5, long_period = 20 } = params;
  const ma5 = data.ma5[index];
  const ma5Prev = data.ma5[index - 1];
  const ma20 = data.ma20[index];
  const ma20Prev = data.ma20[index - 1];
  
  if (ma5 === null || ma5Prev === null || ma20 === null || ma20Prev === null) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }
  
  // 金叉：短均线从下穿过长均线
  if (ma5Prev <= ma20Prev && ma5 > ma20) {
    return { shouldBuy: true, shouldSell: false, reason: 'MA金叉' };
  }
  
  // 死叉：短均线从上穿过长均线
  if (ma5Prev >= ma20Prev && ma5 < ma20) {
    return { shouldBuy: false, shouldSell: true, reason: 'MA死叉' };
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