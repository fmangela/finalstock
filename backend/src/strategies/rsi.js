/**
 * RSI 相对强弱指标策略
 * 信号逻辑：
 *   买入：RSI 低于超卖阈值（默认 30），市场超卖，预期反弹
 *   卖出：RSI 高于超买阈值（默认 70），市场超买，预期回调
 */

const name = 'rsi';
const displayName = 'RSI相对强弱';
const description = 'RSI低于超卖阈值买入，高于超买阈值卖出';

const getDefaultParams = () => ({
  rsi_period: 14,  // RSI 计算周期
  oversold: 30,    // 超卖阈值：低于此值视为超卖
  overbought: 70   // 超买阈值：高于此值视为超买
});

const calculateSignal = (data, index, params) => {
  const { rsi_period = 14, oversold = 30, overbought = 70 } = params;
  const rsi = data.rsi[index];

  // RSI 尚未计算出有效值（数据不足 period 天）
  if (rsi === null || rsi === undefined) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }

  // 超卖区域：RSI < oversold，买入信号
  if (rsi < oversold) {
    return { shouldBuy: true, shouldSell: false, reason: `RSI超卖(${rsi.toFixed(1)}<${oversold})` };
  }

  // 超买区域：RSI > overbought，卖出信号
  if (rsi > overbought) {
    return { shouldBuy: false, shouldSell: true, reason: `RSI超买(${rsi.toFixed(1)}>${overbought})` };
  }

  return { shouldBuy: false, shouldSell: false, reason: '' };
};

module.exports = { name, displayName, description, getDefaultParams, calculateSignal };
