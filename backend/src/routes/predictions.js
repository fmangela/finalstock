const router = require('express').Router();
const predictionController = require('../controllers/predictionController');

router.get('/list', predictionController.getList);
router.post('/generate', predictionController.generate);
router.post('/:id/abandon', predictionController.abandon);
router.put('/:id/status', predictionController.updateStatus);

module.exports = router;
