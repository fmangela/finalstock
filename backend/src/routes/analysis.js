const router = require('express').Router();
const analysisController = require('../controllers/analysisController');

router.get('/guidance/today', analysisController.getToday);
router.post('/guidance/save', analysisController.save);

module.exports = router;
