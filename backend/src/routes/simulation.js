const router = require('express').Router();
const simulationController = require('../controllers/simulationController');

router.get('/account', simulationController.getAccount);
router.get('/positions', simulationController.getPositions);
router.post('/buy', simulationController.buy);
router.post('/sell', simulationController.sell);

module.exports = router;
