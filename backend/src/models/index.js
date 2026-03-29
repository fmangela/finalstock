// 所有 Sequelize 数据模型定义
// 每个模型对应数据库中的一张表，字段与表结构保持一致
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ─── 系统配置表 ───────────────────────────────────────────────
// 存储所有可配置项，按 config_group + config_key 分组管理
const SystemConfig = sequelize.define('SystemConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  config_group: { type: DataTypes.STRING(50), allowNull: false },  // 配置分组，如 news / llm_config / logging
  config_key:   { type: DataTypes.STRING(100), allowNull: false }, // 配置键名
  config_value: { type: DataTypes.TEXT },                          // 配置值（统一存字符串）
  is_encrypted: { type: DataTypes.BOOLEAN, defaultValue: false }   // 是否加密存储（预留）
}, { tableName: 'system_configs', timestamps: true, underscored: true });

// ─── 财经新闻表 ───────────────────────────────────────────────
const StockNews = sequelize.define('StockNews', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title:           { type: DataTypes.STRING(500), allowNull: false },
  content:         { type: DataTypes.TEXT },
  source:          { type: DataTypes.STRING(50) },   // 新闻来源，如"东方财富"
  source_url:      { type: DataTypes.STRING(500) },  // 原文链接
  pub_date:        { type: DataTypes.DATE },          // 发布时间
  sentiment_score: { type: DataTypes.FLOAT, defaultValue: 0 },    // 情感分值（预留）
  related_stocks:  { type: DataTypes.JSON },          // 关联股票代码列表
  importance:      { type: DataTypes.INTEGER, defaultValue: 1 }   // 重要程度 1-5
}, { tableName: 'stock_news', timestamps: true, underscored: true, updatedAt: false,
  indexes: [{ fields: ['pub_date'] }, { fields: ['created_at'] }] });

// ─── AI 选股记录表 ────────────────────────────────────────────
// 记录每次 LLM 选股的结果及后续跟踪状态
const StockPrediction = sequelize.define('StockPrediction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stock_code:         { type: DataTypes.STRING(10), allowNull: false },
  stock_name:         { type: DataTypes.STRING(50) },
  stockup_date:       { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }, // 选股时间
  target_price:       { type: DataTypes.DECIMAL(10, 2) },  // 目标价
  stop_loss:          { type: DataTypes.DECIMAL(10, 2) },  // 止损价
  confidence:         { type: DataTypes.FLOAT },            // 置信度 0-1
  reason:             { type: DataTypes.TEXT },             // 选股理由
  status:             { type: DataTypes.ENUM('active', 'success', 'failed', 'abandoned', 'expired'), defaultValue: 'active' },
  actual_result:      { type: DataTypes.TEXT },             // 实际结果记录
  llm_model:          { type: DataTypes.STRING(50) },       // 使用的模型名称
  llm_params:         { type: DataTypes.JSON },             // 模型调用参数
  observation_period: { type: DataTypes.STRING(20) },       // 观测周期：一周/一月/一年
  llm_response:       { type: DataTypes.TEXT },             // 模型原始返回内容
  prompt_id:          { type: DataTypes.INTEGER },          // 使用的提示词 ID
  prompt_name:        { type: DataTypes.STRING(100) }       // 使用的提示词名称（冗余存储）
}, { tableName: 'stock_predictions', timestamps: true, underscored: true,
  indexes: [{ fields: ['stock_code'] }, { fields: ['status'] }, { fields: ['stockup_date'] }] });

// ─── 选股提示词模板表 ─────────────────────────────────────────
const StockPrompt = sequelize.define('StockPrompt', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  content:         { type: DataTypes.TEXT, allowNull: false },          // 提示词正文
  market_type:     { type: DataTypes.STRING(20), defaultValue: 'A股' },
  push_news:       { type: DataTypes.BOOLEAN, defaultValue: false },    // 是否附加近期要闻
  push_stock_info: { type: DataTypes.BOOLEAN, defaultValue: false },    // 是否附加大盘数据
  output_format:   { type: DataTypes.TEXT, allowNull: true }            // 要求模型输出的格式说明
}, { tableName: 'stock_prompts', timestamps: true, underscored: true });

// ─── 模拟账户表 ───────────────────────────────────────────────
// 全局唯一一条记录（id=1），记录虚拟资金状态
const SimulationAccount = sequelize.define('SimulationAccount', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  initial_capital:    { type: DataTypes.DECIMAL(15, 2), defaultValue: 1000000 }, // 初始资金
  current_capital:    { type: DataTypes.DECIMAL(15, 2), defaultValue: 1000000 }, // 当前可用资金
  total_profit_loss:  { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },       // 累计盈亏
  total_trades:       { type: DataTypes.INTEGER, defaultValue: 0 },              // 总交易次数
  win_trades:         { type: DataTypes.INTEGER, defaultValue: 0 }               // 盈利次数
}, { tableName: 'simulation_account', timestamps: true, underscored: true });

// ─── 模拟持仓表 ───────────────────────────────────────────────
const SimulationPosition = sequelize.define('SimulationPosition', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  prediction_id: { type: DataTypes.INTEGER },                              // 关联的选股记录
  stock_code:    { type: DataTypes.STRING(10), allowNull: false },
  stock_name:    { type: DataTypes.STRING(50) },
  buy_date:      { type: DataTypes.DATEONLY, allowNull: false },
  buy_price:     { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  shares:        { type: DataTypes.INTEGER, allowNull: false },            // 持股数量
  current_price: { type: DataTypes.DECIMAL(10, 2) },                      // 当前价（展示用）
  status:        { type: DataTypes.ENUM('holding', 'sold'), defaultValue: 'holding' },
  sell_date:     { type: DataTypes.DATEONLY },
  sell_price:    { type: DataTypes.DECIMAL(10, 2) },
  profit_loss:   { type: DataTypes.DECIMAL(10, 2) }                       // 本次交易盈亏金额
}, { tableName: 'simulation_positions', timestamps: true, underscored: true,
  indexes: [{ fields: ['stock_code'] }, { fields: ['status'] }] });

// ─── 每日市场指导表 ───────────────────────────────────────────
const DailyGuidance = sequelize.define('DailyGuidance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  trade_date:       { type: DataTypes.DATEONLY, allowNull: false, unique: true }, // 交易日期（唯一）
  market_overall:   { type: DataTypes.STRING(20) },   // 大盘整体判断：看多/看空/震荡
  guidance:         { type: DataTypes.TEXT },          // 操作建议正文
  risk_level:       { type: DataTypes.INTEGER, defaultValue: 3 }, // 风险等级 1-5
  key_stocks:       { type: DataTypes.JSON },          // 重点关注股票列表
  analysis_summary: { type: DataTypes.TEXT }           // 分析摘要
}, { tableName: 'daily_guidance', timestamps: true, underscored: true });

// ─── 回测配置表 ───────────────────────────────────────────────
// 保存用户常用的回测参数组合，方便复用
const BacktestConfig = sequelize.define('BacktestConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  stock_code:      { type: DataTypes.STRING(10), allowNull: false },
  stock_name:      { type: DataTypes.STRING(50) },
  start_date:      { type: DataTypes.DATEONLY, allowNull: false },
  end_date:        { type: DataTypes.DATEONLY, allowNull: false },
  initial_capital: { type: DataTypes.DECIMAL(15, 2), defaultValue: 100000 },
  buy_strategy:    { type: DataTypes.TEXT },  // 买入策略描述
  sell_strategy:   { type: DataTypes.TEXT },  // 卖出策略描述
  params:          { type: DataTypes.JSON }   // 策略参数 JSON
}, { tableName: 'backtest_configs', timestamps: true, underscored: true });

// ─── 回测结果表 ───────────────────────────────────────────────
// 存储每次回测的完整结果，包含 K 线、指标、交易记录等图表数据
const BacktestResult = sequelize.define('BacktestResult', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  config_id:           { type: DataTypes.INTEGER },
  stock_code:          { type: DataTypes.STRING(10), allowNull: false },
  stock_name:          { type: DataTypes.STRING(50) },
  start_date:          { type: DataTypes.DATEONLY, allowNull: false },
  end_date:            { type: DataTypes.DATEONLY, allowNull: false },
  initial_capital:     { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  final_capital:       { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  total_return:        { type: DataTypes.DECIMAL(10, 4) },  // 总收益率（%）
  annual_return:       { type: DataTypes.DECIMAL(10, 4) },  // 年化收益率（%）
  max_drawdown:        { type: DataTypes.DECIMAL(10, 4) },  // 最大回撤（%）
  win_rate:            { type: DataTypes.DECIMAL(10, 4) },  // 胜率（%）
  total_trades:        { type: DataTypes.INTEGER, defaultValue: 0 },
  profit_trades:       { type: DataTypes.INTEGER, defaultValue: 0 },
  loss_trades:         { type: DataTypes.INTEGER, defaultValue: 0 },
  sharpe_ratio:        { type: DataTypes.DECIMAL(10, 4) },  // 夏普比率
  trades_json:         { type: DataTypes.JSON },  // 完整交易记录列表
  equity_curve:        { type: DataTypes.JSON },  // 权益曲线数据点
  monthly_returns:     { type: DataTypes.JSON },  // 月度收益率
  kline_data:          { type: DataTypes.JSON },  // K 线图表数据
  buy_points:          { type: DataTypes.JSON },  // 买入点坐标
  sell_points:         { type: DataTypes.JSON },  // 卖出点坐标
  ma5:                 { type: DataTypes.JSON },  // MA5 指标数据
  ma20:                { type: DataTypes.JSON },  // MA20 指标数据
  strategy_id:         { type: DataTypes.INTEGER },
  strategy_instance_id:{ type: DataTypes.INTEGER },
  strategy_params_json:{ type: DataTypes.JSON }   // 本次回测使用的策略参数快照
}, { tableName: 'backtest_results', timestamps: true, underscored: true,
  indexes: [{ fields: ['stock_code'] }, { fields: ['created_at'] }] });

// ─── 策略定义表 ───────────────────────────────────────────────
// 系统内置策略（MA/RSI/MACD/BOLL/Breakout）的元数据
const BacktestStrategy = sequelize.define('BacktestStrategy', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:          { type: DataTypes.STRING(100), allowNull: false },
  description:   { type: DataTypes.TEXT },
  strategy_type: { type: DataTypes.STRING(50), allowNull: false }, // 对应代码中的策略标识
  category:      { type: DataTypes.STRING(50), defaultValue: '技术指标' },
  is_system:     { type: DataTypes.TINYINT, defaultValue: 1 }      // 1=系统内置，0=用户自定义
}, { tableName: 'backtest_strategies', timestamps: true, underscored: true });

// ─── 策略参数定义表 ───────────────────────────────────────────
// 描述每个策略有哪些可调参数及其取值范围，供前端动态渲染表单
const StrategyParam = sequelize.define('StrategyParam', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  strategy_id:  { type: DataTypes.INTEGER, allowNull: false },
  param_name:   { type: DataTypes.STRING(50), allowNull: false },   // 参数字段名
  param_label:  { type: DataTypes.STRING(100), allowNull: false },  // 前端显示名称
  param_type:   { type: DataTypes.STRING(20), defaultValue: 'number' },
  default_value:{ type: DataTypes.STRING(100) },
  min_value:    { type: DataTypes.DECIMAL(10, 2) },
  max_value:    { type: DataTypes.DECIMAL(10, 2) },
  step:         { type: DataTypes.DECIMAL(10, 2), defaultValue: 1 },
  options:      { type: DataTypes.JSON }  // 枚举类型时的选项列表
}, { tableName: 'strategy_params', timestamps: true, underscored: true });

// ─── 策略实例表 ───────────────────────────────────────────────
// 用户保存的参数组合，可收藏和复用
const StrategyInstance = sequelize.define('StrategyInstance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:        { type: DataTypes.STRING(100), allowNull: false },
  strategy_id: { type: DataTypes.INTEGER, allowNull: false },
  params_json: { type: DataTypes.JSON, allowNull: false },  // 参数值快照
  description: { type: DataTypes.TEXT },
  is_favorite: { type: DataTypes.TINYINT, defaultValue: 0 }, // 是否收藏
  use_count:   { type: DataTypes.INTEGER, defaultValue: 0 }  // 使用次数统计
}, { tableName: 'strategy_instances', timestamps: true, underscored: true });

// ─── K线历史缓存表 ────────────────────────────────────────────
// 按股票代码+日期存储每日 OHLCV，查询时先查此表，缺失再调 API 补全
const KlineCache = sequelize.define('KlineCache', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stock_code: { type: DataTypes.STRING(10), allowNull: false },
  trade_date: { type: DataTypes.DATEONLY, allowNull: false },
  open:       { type: DataTypes.DECIMAL(10, 3), allowNull: false },
  close:      { type: DataTypes.DECIMAL(10, 3), allowNull: false },
  high:       { type: DataTypes.DECIMAL(10, 3), allowNull: false },
  low:        { type: DataTypes.DECIMAL(10, 3), allowNull: false },
  volume:     { type: DataTypes.BIGINT, defaultValue: 0 },
  amount:     { type: DataTypes.DECIMAL(20, 2), defaultValue: 0 }
}, { tableName: 'stock_kline_cache', timestamps: true, underscored: true,
  indexes: [{ unique: true, fields: ['stock_code', 'trade_date'] }] });

// ─── 模拟交易任务表 ───────────────────────────────────────────
// 每条记录代表一个"活的"模拟账户，持续跟踪某只股票的实时虚拟交易
const SimTask = sequelize.define('SimTask', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stock_code:       { type: DataTypes.STRING(10), allowNull: false },
  stock_name:       { type: DataTypes.STRING(50) },
  initial_capital:  { type: DataTypes.DECIMAL(15, 2), defaultValue: 100000 }, // 初始资金
  cash_balance:     { type: DataTypes.DECIMAL(15, 2), defaultValue: 100000 }, // 当前现金
  shares:           { type: DataTypes.INTEGER, defaultValue: 0 },             // 当前持股
  avg_cost:         { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },      // 持仓均价
  strategy_type:    { type: DataTypes.STRING(20), defaultValue: 'ma' },       // 策略类型
  strategy_params:  { type: DataTypes.JSON },                                  // 策略参数
  trade_timing:     { type: DataTypes.ENUM('pre_open', 'pre_close'), defaultValue: 'pre_close' }, // 盘前/收盘前
  status:           { type: DataTypes.ENUM('running', 'paused', 'stopped'), defaultValue: 'running' },
  last_run_date:    { type: DataTypes.DATEONLY },                              // 最近执行日期
  total_return:     { type: DataTypes.DECIMAL(10, 4), defaultValue: 0 },      // 总收益率(%)
  max_drawdown:     { type: DataTypes.DECIMAL(10, 4), defaultValue: 0 },      // 最大回撤(%)
  total_trades:     { type: DataTypes.INTEGER, defaultValue: 0 },
  win_trades:       { type: DataTypes.INTEGER, defaultValue: 0 },
  peak_value:       { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 }       // 历史最高总资产（用于计算最大回撤）
}, { tableName: 'sim_tasks', timestamps: true, underscored: true,
  indexes: [{ fields: ['stock_code'] }, { fields: ['status'] }] });

// ─── 模拟交易记录表 ───────────────────────────────────────────
// 每次买入/卖出操作的详细记录，含滑点、涨跌停标记、盈亏
const SimTrade = sequelize.define('SimTrade', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  task_id:       { type: DataTypes.INTEGER, allowNull: false },
  trade_date:    { type: DataTypes.DATEONLY, allowNull: false },
  type:          { type: DataTypes.ENUM('buy', 'sell'), allowNull: false },
  price:         { type: DataTypes.DECIMAL(10, 3), allowNull: false },  // 实际成交价（含滑点）
  raw_price:     { type: DataTypes.DECIMAL(10, 3) },                    // 信号触发时原始价格
  shares:        { type: DataTypes.INTEGER, allowNull: false },
  amount:        { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  slippage:      { type: DataTypes.DECIMAL(10, 4), defaultValue: 0 },   // 滑点金额
  signal_reason: { type: DataTypes.STRING(200) },                       // 触发信号描述
  is_limit_up:   { type: DataTypes.BOOLEAN, defaultValue: false },      // 涨停（无法买入）
  is_limit_down: { type: DataTypes.BOOLEAN, defaultValue: false },      // 跌停（无法卖出）
  cash_before:   { type: DataTypes.DECIMAL(15, 2) },
  cash_after:    { type: DataTypes.DECIMAL(15, 2) },
  profit_loss:   { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },   // 本次盈亏（卖出时）
  hold_days:     { type: DataTypes.INTEGER, defaultValue: 0 }           // 持仓天数（卖出时）
}, { tableName: 'sim_trades', timestamps: true, underscored: true, updatedAt: false,
  indexes: [{ fields: ['task_id'] }, { fields: ['trade_date'] }] });

const AppLog = require('./log');

module.exports = {
  SystemConfig, StockNews, StockPrediction, StockPrompt,
  SimulationAccount, SimulationPosition, DailyGuidance,
  BacktestConfig, BacktestResult, BacktestStrategy, StrategyParam, StrategyInstance,
  KlineCache, SimTask, SimTrade,
  AppLog
};
