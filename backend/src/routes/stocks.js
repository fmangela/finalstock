const router = require('express').Router();
const stockController = require('../controllers/stockController');

router.get('/list', stockController.getList);
router.get('/market/overview', stockController.getMarketOverview);
router.get('/:code/quote', stockController.getQuote);
router.get('/:code/history', stockController.getHistory);

module.exports = router;
