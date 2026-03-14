// 股票行情路由
const router = require('express').Router();
const stockController = require('../controllers/stockController');

router.get('/list', stockController.getList);                  // 股票列表（分页+搜索）
router.get('/market/overview', stockController.getMarketOverview); // 大盘三大指数
router.get('/:code/quote', stockController.getQuote);          // 单只股票实时行情
router.get('/:code/history', stockController.getHistory);      // 历史 K 线数据

module.exports = router;
