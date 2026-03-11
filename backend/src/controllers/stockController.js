const DataService = require('../services/DataService');

exports.getList = async (req, res) => {
  try {
    const { page = 1, pageSize = 50, keyword = '' } = req.query;
    const data = await DataService.getStockList(+page, +pageSize, keyword);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

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

exports.getMarketOverview = async (req, res) => {
  try {
    const data = await DataService.getMarketOverview();
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};
