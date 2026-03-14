// 选股提示词控制器（供部分路由直接调用）
// 提示词模板决定 LLM 选股时的分析角度和输出格式
const { StockPrompt } = require('../models');

// 获取所有提示词（按创建时间倒序）
exports.getList = async (req, res) => {
  try {
    const prompts = await StockPrompt.findAll({ order: [['created_at', 'DESC']] });
    res.json({ code: 0, data: prompts });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 新增提示词
exports.create = async (req, res) => {
  try {
    const { name, content, market_type, push_news, push_stock_info, output_format } = req.body;
    const prompt = await StockPrompt.create({ name, content, market_type, push_news, push_stock_info, output_format });
    res.json({ code: 0, data: prompt });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 更新提示词内容
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const prompt = await StockPrompt.findByPk(id);
    if (!prompt) return res.status(404).json({ code: 404, message: '提示词不存在' });
    const { name, content, market_type, push_news, push_stock_info, output_format } = req.body;
    await prompt.update({ name, content, market_type, push_news, push_stock_info, output_format });
    res.json({ code: 0, data: prompt });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 删除提示词
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const prompt = await StockPrompt.findByPk(id);
    if (!prompt) return res.status(404).json({ code: 404, message: '提示词不存在' });
    await prompt.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};
