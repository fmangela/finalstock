/**
 * BOLL 布林带策略
 * 信号逻辑：
 *   买入：价格突破上轨（强势突破，追涨）
 *   卖出：价格跌破下轨（弱势跌破，止损）
 * 注意：此为趋势跟踪用法，与均值回归用法（上轨卖/下轨买）相反
 * 默认参数：周期 20 / 标准差倍数 2
 */

const name = 'boll';
const displayName = 'BOLL布林带';
const description = '价格突破布林带上轨买入，跌破下轨卖出';

const getDefaultParams = () => ({
  boll_period: 20,  // 布林带计算周期（中轨 SMA 周期）
  std_dev: 2        // 上下轨距中轨的标准差倍数
});

const calculateSignal = (data, index, params) => {
  const { boll_period = 20, std_dev = 2 } = params;
  const price = data.prices[index];
  const upper = data.bollUpper[index];
  const lower = data.bollLower[index];

  // 布林带数据不足时不产生信号
  if (upper === null || lower === null) {
    return { shouldBuy: false, shouldSell: false, reason: '' };
  }

  // 价格突破上轨：强势信号，买入
  if (price > upper) {
    return { shouldBuy: true, shouldSell: false, reason: `BOLL突破上轨(${price.toFixed(2)}>${upper.toFixed(2)})` };
  }

  // 价格跌破下轨：弱势信号，卖出
  if (price < lower) {
    return { shouldBuy: false, shouldSell: true, reason: `BOLL跌破下轨(${price.toFixed(2)}<${lower.toFixed(2)})` };
  }

  return { shouldBuy: false, shouldSell: false, reason: '' };
};

module.exports = { name, displayName, description, getDefaultParams, calculateSignal };
