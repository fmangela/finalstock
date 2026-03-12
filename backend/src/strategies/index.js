/**
 * 策略模块统一导出
 * 提供所有策略的注册和管理功能
 */

const ma = require('./ma');
const rsi = require('./rsi');
const macd = require('./macd');
const boll = require('./boll');
const breakout = require('./breakout');
const { calculateAllIndicators } = require('./indicators');

// 策略映射表
const strategies = {
  ma: ma,
  rsi: rsi,
  macd: macd,
  boll: boll,
  breakout: breakout
};

// 注册别名
strategies['ma_cross'] = ma;

/**
 * 获取所有可用策略列表
 */
const getStrategyList = () => {
  return Object.keys(strategies).map(key => ({
    name: key,
    displayName: strategies[key].displayName,
    description: strategies[key].description,
    defaultParams: strategies[key].getDefaultParams()
  }));
};

/**
 * 获取策略实例
 * @param {string} strategyName - 策略名称
 */
const getStrategy = (strategyName) => {
  const strategy = strategies[strategyName];
  if (!strategy) {
    throw new Error(`策略 "${strategyName}" 不存在`);
  }
  return strategy;
};

/**
 * 计算策略信号（统一入口）
 * @param {string} strategyName - 策略名称
 * @param {Object} data - 指标数据
 * @param {number} index - 当前索引
 * @param {Object} params - 策略参数
 */
const calculateSignal = (strategyName, data, index, params = {}) => {
  const strategy = getStrategy(strategyName);
  const defaultParams = strategy.getDefaultParams();
  const mergedParams = { ...defaultParams, ...params };
  return strategy.calculateSignal(data, index, mergedParams);
};

/**
 * 获取策略默认参数
 */
const getDefaultParams = (strategyName) => {
  const strategy = getStrategy(strategyName);
  return strategy.getDefaultParams();
};

module.exports = {
  strategies,
  getStrategyList,
  getStrategy,
  calculateSignal,
  getDefaultParams,
  calculateAllIndicators
};