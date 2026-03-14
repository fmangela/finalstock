// 模拟交易路由
const router = require('express').Router();
const ctrl = require('../controllers/simController');

router.get('/tasks',          ctrl.getTasks);
router.post('/tasks',         ctrl.createTask);
router.put('/tasks/:id',      ctrl.updateTask);
router.delete('/tasks/:id',   ctrl.deleteTask);
router.get('/tasks/:id',      ctrl.getTask);
router.post('/tasks/:id/run', ctrl.runTask);
router.get('/stocks',         ctrl.getStocks);

module.exports = router;
