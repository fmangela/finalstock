const router = require('express').Router();
const backtestController = require('../controllers/backtestController');

router.get('/stocks', backtestController.getBacktestStocks);  // 获取可回测的股票
router.get('/configs', backtestController.getConfigs);        // 获取配置列表
router.post('/configs', backtestController.createConfig);     // 创建配置
router.put('/configs/:id', backtestController.updateConfig);  // 更新配置
router.delete('/configs/:id', backtestController.deleteConfig); // 删除配置

router.get('/results', backtestController.getResults);        // 获取结果列表
router.get('/results/:id', backtestController.getResult);     // 获取单条结果
router.delete('/results/:id', backtestController.deleteResult); // 删除结果

router.post('/run', backtestController.runBacktest);          // 执行回测

module.exports = router;