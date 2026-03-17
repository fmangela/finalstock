// 回测路由
// POST /run 为重型接口，单独加限流
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const backtestController = require('../controllers/backtestController');

const runLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

// 统一校验结果处理：有错误时返回第一条错误信息
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ code: 400, message: errors.array()[0].msg });
  next();
};

// POST /run 的入参校验规则
const runRules = [
  body('stock_code').notEmpty().withMessage('stock_code 不能为空'),
  body('start_date').isDate().withMessage('start_date 格式无效'),
  body('end_date').isDate().withMessage('end_date 格式无效'),
  body('initial_capital').optional().isFloat({ min: 1000 }).withMessage('initial_capital 最小 1000'),
  body('strategy_type').optional().isIn(['ma', 'rsi', 'macd', 'boll', 'breakout']).withMessage('strategy_type 无效')
];

// 回测配置 CRUD
router.get('/stocks', backtestController.getBacktestStocks);
router.get('/configs', backtestController.getConfigs);
router.post('/configs', backtestController.createConfig);
router.put('/configs/:id', backtestController.updateConfig);
router.delete('/configs/:id', backtestController.deleteConfig);

// 回测结果 CRUD
router.get('/results', backtestController.getResults);
router.get('/results/:id', backtestController.getResult);
router.delete('/results/:id', backtestController.deleteResult);

// 执行回测（限流 + 校验通过后才进入控制器）
router.post('/run', runLimiter, runRules, validate, backtestController.runBacktest);

module.exports = router;
