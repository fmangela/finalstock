const router = require('express').Router();
const strategyController = require('../controllers/strategyController');

router.get('/strategies', strategyController.getStrategies);  // 获取策略列表
router.get('/strategies/:id', strategyController.getStrategyDetail);  // 获取策略详情
router.post('/strategies', strategyController.createStrategy);  // 创建策略
router.put('/strategies/:id', strategyController.updateStrategy);  // 更新策略
router.delete('/strategies/:id', strategyController.deleteStrategy);  // 删除策略

router.post('/params', strategyController.addParam);  // 添加策略参数

router.get('/instances', strategyController.getInstances);  // 获取实例列表
router.post('/instances', strategyController.createInstance);  // 创建实例
router.put('/instances/:id', strategyController.updateInstance);  // 更新实例
router.delete('/instances/:id', strategyController.deleteInstance);  // 删除实例

module.exports = router;
