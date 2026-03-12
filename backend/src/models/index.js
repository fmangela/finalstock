const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemConfig = sequelize.define('SystemConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  config_group: { type: DataTypes.STRING(50), allowNull: false },
  config_key: { type: DataTypes.STRING(100), allowNull: false },
  config_value: { type: DataTypes.TEXT },
  is_encrypted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'system_configs', timestamps: true, underscored: true });

const StockNews = sequelize.define('StockNews', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(500), allowNull: false },
  content: { type: DataTypes.TEXT },
  source: { type: DataTypes.STRING(50) },
  source_url: { type: DataTypes.STRING(500) },
  pub_date: { type: DataTypes.DATE },
  sentiment_score: { type: DataTypes.FLOAT, defaultValue: 0 },
  related_stocks: { type: DataTypes.JSON },
  importance: { type: DataTypes.INTEGER, defaultValue: 1 }
}, { tableName: 'stock_news', timestamps: true, underscored: true, updatedAt: false });

const StockPrediction = sequelize.define('StockPrediction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stock_code: { type: DataTypes.STRING(10), allowNull: false },
  stock_name: { type: DataTypes.STRING(50) },
  stockup_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  target_price: { type: DataTypes.DECIMAL(10, 2) },
  stop_loss: { type: DataTypes.DECIMAL(10, 2) },
  confidence: { type: DataTypes.FLOAT },
  reason: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'success', 'failed', 'abandoned'), defaultValue: 'active' },
  actual_result: { type: DataTypes.TEXT },
  llm_model: { type: DataTypes.STRING(50) },
  llm_params: { type: DataTypes.JSON },
  observation_period: { type: DataTypes.STRING(20) },
  llm_response: { type: DataTypes.TEXT },
  prompt_id: { type: DataTypes.INTEGER },
  prompt_name: { type: DataTypes.STRING(100) }
}, { tableName: 'stock_predictions', timestamps: true, underscored: true });

const StockPrompt = sequelize.define('StockPrompt', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  market_type: { type: DataTypes.STRING(20), defaultValue: 'A股' },
  push_news: { type: DataTypes.BOOLEAN, defaultValue: false },
  push_stock_info: { type: DataTypes.BOOLEAN, defaultValue: false },
  output_format: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: 'stock_prompts', timestamps: true, underscored: true });

const SimulationAccount = sequelize.define('SimulationAccount', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  initial_capital: { type: DataTypes.DECIMAL(15, 2), defaultValue: 1000000 },
  current_capital: { type: DataTypes.DECIMAL(15, 2), defaultValue: 1000000 },
  total_profit_loss: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  total_trades: { type: DataTypes.INTEGER, defaultValue: 0 },
  win_trades: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'simulation_account', timestamps: true, underscored: true });

const SimulationPosition = sequelize.define('SimulationPosition', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  prediction_id: { type: DataTypes.INTEGER },
  stock_code: { type: DataTypes.STRING(10), allowNull: false },
  stock_name: { type: DataTypes.STRING(50) },
  buy_date: { type: DataTypes.DATEONLY, allowNull: false },
  buy_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  shares: { type: DataTypes.INTEGER, allowNull: false },
  current_price: { type: DataTypes.DECIMAL(10, 2) },
  status: { type: DataTypes.ENUM('holding', 'sold'), defaultValue: 'holding' },
  sell_date: { type: DataTypes.DATEONLY },
  sell_price: { type: DataTypes.DECIMAL(10, 2) },
  profit_loss: { type: DataTypes.DECIMAL(10, 2) }
}, { tableName: 'simulation_positions', timestamps: true, underscored: true });

const DailyGuidance = sequelize.define('DailyGuidance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  trade_date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
  market_overall: { type: DataTypes.STRING(20) },
  guidance: { type: DataTypes.TEXT },
  risk_level: { type: DataTypes.INTEGER, defaultValue: 3 },
  key_stocks: { type: DataTypes.JSON },
  analysis_summary: { type: DataTypes.TEXT }
}, { tableName: 'daily_guidance', timestamps: true, underscored: true });

const BacktestConfig = sequelize.define('BacktestConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  stock_code: { type: DataTypes.STRING(10), allowNull: false },
  stock_name: { type: DataTypes.STRING(50) },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  initial_capital: { type: DataTypes.DECIMAL(15, 2), defaultValue: 100000 },
  buy_strategy: { type: DataTypes.TEXT },
  sell_strategy: { type: DataTypes.TEXT },
  params: { type: DataTypes.JSON }
}, { tableName: 'backtest_configs', timestamps: true, underscored: true });

const BacktestResult = sequelize.define('BacktestResult', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  config_id: { type: DataTypes.INTEGER },
  stock_code: { type: DataTypes.STRING(10), allowNull: false },
  stock_name: { type: DataTypes.STRING(50) },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  initial_capital: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  final_capital: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  total_return: { type: DataTypes.DECIMAL(10, 4) },
  annual_return: { type: DataTypes.DECIMAL(10, 4) },
  max_drawdown: { type: DataTypes.DECIMAL(10, 4) },
  win_rate: { type: DataTypes.DECIMAL(10, 4) },
  total_trades: { type: DataTypes.INTEGER, defaultValue: 0 },
  profit_trades: { type: DataTypes.INTEGER, defaultValue: 0 },
  loss_trades: { type: DataTypes.INTEGER, defaultValue: 0 },
  sharpe_ratio: { type: DataTypes.DECIMAL(10, 4) },
  trades_json: { type: DataTypes.JSON },
  equity_curve: { type: DataTypes.JSON },
  monthly_returns: { type: DataTypes.JSON }
}, { tableName: 'backtest_results', timestamps: true, underscored: true });

const AppLog = require('./log');

module.exports = { SystemConfig, StockNews, StockPrediction, StockPrompt, SimulationAccount, SimulationPosition, DailyGuidance, BacktestConfig, BacktestResult, AppLog };
