/**
 * MA 均线交叉策略
 * 信号逻辑：
 *   买入：短期均线从下方穿越长期均线（金叉）
 *   卖出：短期均线从上方穿越长期均线（死叉）
 * 默认参数：MA5 / MA20
 */

const name = 'ma';
const displayName = 'MA均线交叉';
const description = '短期均线上穿长期均线买入，下穿卖出';

const getDefaultParams = () => ({
  short_period: 5,   // 短期均线周期
  long_period: 20    // 长期均线周期
});

const calculateSignal = (data, index, params) => {
  const { short_period = 5, long_period = 20 } = params;

  // 取当日和前一日的短/长均线值
  const ma5     = data.ma5[index];
  const ma5Prev = data.ma5[index - 1];
  const ma20     = data.ma20[index];
  const ma20Prev = data.ma20[index - 1];

  // 指标数据不足时不产生信号
  if (ma5 === null || ma5Prev === null || ma20 === null || ma20Prev === null) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }

  // 金叉：前一日短线 ≤ 长线，当日短线 > 长线（向上穿越）
  if (ma5Prev <= ma20Prev && ma5 > ma20) {
    return { shouldBuy: true, shouldSell: false, reason: 'MA金叉' };
  }

  // 死叉：前一日短线 ≥ 长线，当日短线 < 长线（向下穿越）
  if (ma5Prev >= ma20Prev && ma5 < ma20) {
    return { shouldBuy: false, shouldSell: true, reason: 'MA死叉' };
  }

  return { shouldBuy: false, shouldSell: false, reason: '' };
};

module.exports = { name, displayName, description, getDefaultParams, calculateSignal };
