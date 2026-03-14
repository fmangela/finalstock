// 策略管理路由
// 策略（BacktestStrategy）：系统内置的技术指标策略元数据
// 策略实例（StrategyInstance）：用户保存的参数组合，可收藏复用
const router = require('express').Router();
const strategyController = require('../controllers/strategyController');

// 策略 CRUD
router.get('/strategies', strategyController.getStrategies);
router.get('/strategies/:id', strategyController.getStrategyDetail); // 含参数定义
router.post('/strategies', strategyController.createStrategy);
router.put('/strategies/:id', strategyController.updateStrategy);
router.delete('/strategies/:id', strategyController.deleteStrategy);

// 策略参数定义（供前端动态渲染表单）
router.post('/params', strategyController.addParam);

// 策略实例 CRUD（用户自定义参数组合）
router.get('/instances', strategyController.getInstances);
router.post('/instances', strategyController.createInstance);
router.put('/instances/:id', strategyController.updateInstance);
router.delete('/instances/:id', strategyController.deleteInstance);

module.exports = router;
