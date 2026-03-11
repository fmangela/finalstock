const router = require('express').Router();
const predictionController = require('../controllers/predictionController');

router.get('/list', predictionController.getList);
router.post('/generate', predictionController.generate);
router.post('/execute', predictionController.execute);
router.post('/confirm', predictionController.confirm);
router.post('/:id/abandon', predictionController.abandon);
router.put('/:id/status', predictionController.updateStatus);
router.delete('/:id', predictionController.delete);
router.post('/restore', predictionController.restore);
router.post('/batch-delete', predictionController.batchDelete);

module.exports = router;
