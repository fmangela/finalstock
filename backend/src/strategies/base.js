/**
 * 策略基础接口
 * 所有策略必须遵循此接口规范
 */

/**
 * 计算策略信号
 * @param {Object} data - 包含所有指标数据的对象
 * @param {number} index - 当前 K 线索引
 * @param {Object} params - 策略参数
 * @returns {Object} { shouldBuy, shouldSell, reason }
 */
const calculateSignal = (data, index, params) => {
  throw new Error('calculateSignal must be implemented by strategy');
};

/**
 * 获取默认参数
 * @returns {Object} 默认参数对象
 */
const getDefaultParams = () => {
  return {};
};

/**
 * 获取策略描述
 * @returns {string} 策略描述
 */
const getDescription = () => {
  return '';
};

module.exports = {
  calculateSignal,
  getDefaultParams,
  getDescription
};