const router = require('express').Router();
const { StockPrompt } = require('../models');

// 获取提示词列表
router.get('/list', async (req, res) => {
  try {
    const prompts = await StockPrompt.findAll({ order: [['id', 'DESC']] });
    res.json({ code: 0, data: prompts });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 新增提示词
router.post('/', async (req, res) => {
  try {
    const { name, content, market_type, push_news, push_stock_info } = req.body;
    const prompt = await StockPrompt.create({ name, content, market_type, push_news, push_stock_info });
    res.json({ code: 0, data: prompt });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 修改提示词
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content, market_type, push_news, push_stock_info } = req.body;
    await StockPrompt.update({ name, content, market_type, push_news, push_stock_info }, { where: { id } });
    res.json({ code: 0, message: '更新成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 删除提示词
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await StockPrompt.destroy({ where: { id } });
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

module.exports = router;