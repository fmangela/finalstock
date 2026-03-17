// AI 选股路由
// execute 和 confirm 为重型接口，单独加限流
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const predictionController = require('../controllers/predictionController');

const heavyLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

// 统一校验结果处理
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ code: 400, message: errors.array()[0].msg });
  next();
};

// 手动新增选股记录时，股票代码不能为空
const generateRules = [
  body('stock_code').notEmpty().withMessage('stock_code 不能为空')
];

// 确认选股时，stocks 必须是非空数组，且每项必须有 code 字段
const confirmRules = [
  body('stocks').isArray({ min: 1 }).withMessage('stocks 不能为空'),
  body('stocks.*.code').notEmpty().withMessage('股票代码不能为空')
];

router.get('/list', predictionController.getList);                              // 选股记录列表
router.post('/generate', generateRules, validate, predictionController.generate); // 手动新增
router.post('/execute', heavyLimiter, predictionController.execute);                          // 调用 LLM 选股
router.post('/confirm', heavyLimiter, confirmRules, validate, predictionController.confirm);  // 确认并保存
router.post('/:id/abandon', predictionController.abandon);                      // 放弃跟踪
router.put('/:id/status', predictionController.updateStatus);                   // 更新状态
router.delete('/:id', predictionController.delete);                             // 删除单条
router.post('/restore', predictionController.restore);                          // 批量恢复
router.post('/batch-delete', predictionController.batchDelete);                 // 批量删除

module.exports = router;
