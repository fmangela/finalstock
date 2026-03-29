// 自动流程路由
const router = require('express').Router();
const ctrl = require('../controllers/workflowController');

router.get('/config',              ctrl.getConfig);
router.post('/config',             ctrl.saveConfig);
router.get('/prompts',             ctrl.getPrompts);
router.get('/strategies',          ctrl.getStrategies);
router.post('/run/pick-stock',     ctrl.runAutoPickStock);
router.post('/run/backtest',       ctrl.runAutoBacktest);
router.get('/run/backtest/task/:taskId', ctrl.getBacktestTaskStatus);
router.post('/run/simulation',     ctrl.runAutoSimulation);
router.post('/reload-schedule',    ctrl.reloadSchedule);
router.get('/calendar',            ctrl.getCalendar);

module.exports = router;
