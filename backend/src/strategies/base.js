/**
 * 策略基础接口规范（文档用途，非运行时基类）
 * 所有策略模块必须导出以下三个函数，命名和签名保持一致
 *
 * 策略文件结构示例：
 *   const name = 'xxx';
 *   const displayName = '显示名称';
 *   const description = '策略说明';
 *   const getDefaultParams = () => ({ ... });
 *   const calculateSignal = (data, index, params) => ({ shouldBuy, shouldSell, reason });
 *   module.exports = { name, displayName, description, getDefaultParams, calculateSignal };
 */

/**
 * 计算策略信号（每个策略必须实现）
 * @param {Object} data   - calculateAllIndicators 返回的指标数据对象
 * @param {number} index  - 当前 K 线在数组中的索引（从 1 开始，需要前一日数据）
 * @param {Object} params - 策略参数（已与默认值合并）
 * @returns {{ shouldBuy: boolean, shouldSell: boolean, reason: string }}
 */
const calculateSignal = (data, index, params) => {
  throw new Error('calculateSignal must be implemented by strategy');
};

/**
 * 获取策略默认参数（每个策略必须实现）
 * @returns {Object} 参数名 → 默认值 的映射
 */
const getDefaultParams = () => {
  return {};
};

/**
 * 获取策略描述文本（可选）
 * @returns {string}
 */
const getDescription = () => {
  return '';
};

module.exports = {
  calculateSignal,
  getDefaultParams,
  getDescription
};
