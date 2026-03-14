/**
 * 策略模块统一入口
 * 注册所有内置策略，对外提供统一的信号计算接口
 * 新增策略只需在此处注册，无需修改回测控制器
 */

const ma       = require('./ma');
const rsi      = require('./rsi');
const macd     = require('./macd');
const boll     = require('./boll');
const breakout = require('./breakout');
const { calculateAllIndicators } = require('./indicators');

// 策略注册表：key 为策略标识，value 为策略实现模块
const strategies = {
  ma,
  rsi,
  macd,
  boll,
  breakout
};

// 兼容别名：ma_cross 等同于 ma
strategies['ma_cross'] = ma;

/**
 * 获取所有可用策略的元数据列表（供前端下拉选择）
 * 返回：name / displayName / description / defaultParams
 */
const getStrategyList = () => {
  return Object.keys(strategies).map(key => ({
    name:          key,
    displayName:   strategies[key].displayName,
    description:   strategies[key].description,
    defaultParams: strategies[key].getDefaultParams()
  }));
};

/**
 * 获取策略实例，不存在时抛出异常
 * @param {string} strategyName - 策略标识，如 'ma' / 'rsi'
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
 * 将用户传入的参数与策略默认参数合并后调用策略的 calculateSignal
 * @param {string} strategyName - 策略标识
 * @param {Object} data         - 预计算好的指标数据（由 calculateAllIndicators 生成）
 * @param {number} index        - 当前 K 线索引
 * @param {Object} params       - 用户自定义参数（会覆盖默认值）
 * @returns {{ shouldBuy, shouldSell, reason }}
 */
const calculateSignal = (strategyName, data, index, params = {}) => {
  const strategy = getStrategy(strategyName);
  const defaultParams = strategy.getDefaultParams();
  // 用户参数优先，未传的字段使用策略默认值
  const mergedParams = { ...defaultParams, ...params };
  return strategy.calculateSignal(data, index, mergedParams);
};

/**
 * 获取指定策略的默认参数
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
