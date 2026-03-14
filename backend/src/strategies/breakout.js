/**
 * Breakout 价格突破策略（海龟交易法则变体）
 * 信号逻辑：
 *   买入：当日收盘价突破近 N 日最高价（向上突破，趋势启动）
 *   卖出：当日收盘价跌破近 N 日最低价（向下突破，趋势反转）
 * 高低价优先使用 K 线真实最高/最低价，而非收盘价
 * 默认参数：N = 20 日
 */

const name = 'breakout';
const displayName = '突破策略';
const description = '突破N日高点买入，跌破N日低点卖出';

const getDefaultParams = () => ({
  breakout_period: 20  // 回溯天数
});

const calculateSignal = (data, index, params) => {
  const { breakout_period = 20 } = params;
  const price = data.prices[index];
  const highs = data.breakoutHighs[index];  // N 日最高价
  const lows  = data.breakoutLows[index];   // N 日最低价

  // 数据不足时不产生信号
  if (highs === null || lows === null) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }

  // 收盘价突破 N 日高点：趋势向上，买入
  if (price > highs) {
    return { shouldBuy: true, shouldSell: false, reason: `突破${breakout_period}日高点(${price.toFixed(2)}>${highs.toFixed(2)})` };
  }

  // 收盘价跌破 N 日低点：趋势向下，卖出
  if (price < lows) {
    return { shouldBuy: false, shouldSell: true, reason: `跌破${breakout_period}日低点(${price.toFixed(2)}<${lows.toFixed(2)})` };
  }

  return { shouldBuy: false, shouldSell: false, reason: '' };
};

module.exports = { name, displayName, description, getDefaultParams, calculateSignal };
