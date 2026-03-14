// 股票行情控制器：通过 DataService 获取行情数据并返回给前端
const DataService = require('../services/DataService');

// 获取 A 股股票列表（支持分页和关键字搜索）
exports.getList = async (req, res) => {
  try {
    const { page = 1, pageSize = 50, keyword = '' } = req.query;
    const data = await DataService.getStockList(+page, +pageSize, keyword);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 获取单只股票实时行情
exports.getQuote = async (req, res) => {
  try {
    const { code } = req.params;
    const data = await DataService.getStockQuote(code);
    if (!data) return res.status(404).json({ code: 404, message: '股票不存在' });
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 获取历史 K 线数据
// period: daily / weekly / monthly；limit: 返回条数
exports.getHistory = async (req, res) => {
  try {
    const { code } = req.params;
    const { period = 'daily', limit = 100 } = req.query;
    const data = await DataService.getStockHistory(code, period, +limit);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 获取大盘三大指数概览（上证、深证、创业板）
exports.getMarketOverview = async (req, res) => {
  try {
    const data = await DataService.getMarketOverview();
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};
