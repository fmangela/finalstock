// 每日市场指导路由
const router = require('express').Router();
const analysisController = require('../controllers/analysisController');

router.get('/guidance/today', analysisController.getToday);  // 获取今日市场指导
router.post('/guidance/save', analysisController.save);      // 保存/更新今日指导

module.exports = router;
