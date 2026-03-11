const router = require('express').Router();
const newsController = require('../controllers/newsController');

router.get('/list', newsController.getList);
router.post('/refresh', newsController.refresh);

module.exports = router;
