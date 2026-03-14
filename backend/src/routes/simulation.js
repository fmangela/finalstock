// 模拟交易路由
// 买入和卖出接口均有参数校验，防止非法数据写入账户
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const simulationController = require('../controllers/simulationController');

// 统一校验结果处理
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ code: 400, message: errors.array()[0].msg });
  next();
};

// 买入校验：股票代码不能为空，股数必须为正整数，价格必须大于 0
const buyRules = [
  body('stock_code').notEmpty().withMessage('stock_code 不能为空'),
  body('shares').isInt({ min: 1 }).withMessage('shares 必须为正整数'),
  body('price').isFloat({ min: 0.01 }).withMessage('price 必须大于 0')
];

// 卖出校验：持仓 ID 必须为正整数，价格必须大于 0
const sellRules = [
  body('position_id').isInt({ min: 1 }).withMessage('position_id 无效'),
  body('price').isFloat({ min: 0.01 }).withMessage('price 必须大于 0')
];

router.get('/account', simulationController.getAccount);       // 获取账户信息
router.get('/positions', simulationController.getPositions);   // 获取持仓列表
router.post('/buy', buyRules, validate, simulationController.buy);   // 买入
router.post('/sell', sellRules, validate, simulationController.sell); // 卖出

module.exports = router;
