// 财经新闻路由
const router = require('express').Router();
const newsController = require('../controllers/newsController');

router.get('/list', newsController.getList);       // 获取新闻列表（优先读库，库空则实时拉取）
router.post('/refresh', newsController.refresh);   // 手动触发新闻同步

module.exports = router;
