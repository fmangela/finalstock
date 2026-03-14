// 策略管理控制器
// 管理三类数据：
//   BacktestStrategy  - 策略元数据（名称、类型、描述）
//   StrategyParam     - 策略参数定义（供前端动态渲染表单）
//   StrategyInstance  - 用户保存的参数组合（可收藏复用）
const { BacktestStrategy, StrategyParam, StrategyInstance, BacktestResult } = require('../models');

// 获取所有策略（按 ID 升序，系统内置策略排在前面）
exports.getStrategies = async (req, res) => {
  try {
    const strategies = await BacktestStrategy.findAll({ 
      order: [['id', 'ASC']] 
    });
    res.json({ code: 0, data: strategies });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 获取策略详情（含参数）
exports.getStrategyDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const strategy = await BacktestStrategy.findByPk(id);
    if (!strategy) return res.status(404).json({ code: 404, message: '策略不存在' });
    
    const params = await StrategyParam.findAll({ 
      where: { strategy_id: id },
      order: [['id', 'ASC']]
    });
    
    res.json({ code: 0, data: { ...strategy.toJSON(), params } });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 创建策略
exports.createStrategy = async (req, res) => {
  try {
    const { name, description, strategy_type, category } = req.body;
    const strategy = await BacktestStrategy.create({ name, description, strategy_type, category });
    res.json({ code: 0, data: strategy });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 更新策略
exports.updateStrategy = async (req, res) => {
  try {
    const { id } = req.params;
    const strategy = await BacktestStrategy.findByPk(id);
    if (!strategy) return res.status(404).json({ code: 404, message: '策略不存在' });
    
    const { name, description, category } = req.body;
    await strategy.update({ name, description, category });
    res.json({ code: 0, data: strategy });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 删除策略
exports.deleteStrategy = async (req, res) => {
  try {
    const { id } = req.params;
    await BacktestStrategy.destroy({ where: { id } });
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 为策略添加参数定义（param_name 为字段名，param_label 为前端显示名）
exports.addParam = async (req, res) => {
  try {
    const { strategy_id, param_name, param_label, param_type, default_value, min_value, max_value, step, options } = req.body;
    const param = await StrategyParam.create({ strategy_id, param_name, param_label, param_type, default_value, min_value, max_value, step, options });
    res.json({ code: 0, data: param });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 获取策略实例列表，按使用次数倒序（常用的排前面）
// 返回时附加策略名称和类型，避免前端再次查询
exports.getInstances = async (req, res) => {
  try {
    const { strategy_id } = req.query;
    const where = strategy_id ? { strategy_id } : {};
    const instances = await StrategyInstance.findAll({
      where,
      order: [['use_count', 'DESC'], ['created_at', 'DESC']]
    });
    // 批量查询策略信息，构建 id→策略 的映射，避免 N+1 查询
    const strategies = await BacktestStrategy.findAll();
    const strategyMap = {};
    strategies.forEach(s => { strategyMap[s.id] = s; });
    
    const result = instances.map(i => ({
      ...i.toJSON(),
      strategy_name: strategyMap[i.strategy_id]?.name || '',
      strategy_type: strategyMap[i.strategy_id]?.strategy_type || ''
    }));
    
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 创建策略实例（保存一组参数组合，供下次回测直接复用）
exports.createInstance = async (req, res) => {
  try {
    const { name, strategy_id, params_json, description } = req.body;
    const instance = await StrategyInstance.create({ name, strategy_id, params_json, description });
    res.json({ code: 0, data: instance });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 更新策略实例
exports.updateInstance = async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await StrategyInstance.findByPk(id);
    if (!instance) return res.status(404).json({ code: 404, message: '实例不存在' });
    
    const { name, params_json, description, is_favorite } = req.body;
    await instance.update({ name, params_json, description, is_favorite });
    res.json({ code: 0, data: instance });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 删除策略实例
exports.deleteInstance = async (req, res) => {
  try {
    const { id } = req.params;
    await StrategyInstance.destroy({ where: { id } });
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 更新实例使用次数（每次回测时调用，用于排序热门实例）
exports.useInstance = async (id) => {
  const instance = await StrategyInstance.findByPk(id);
  if (instance) {
    await instance.update({ use_count: instance.use_count + 1 });
  }
};
