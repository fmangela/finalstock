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
  prediction_date: { type: DataTypes.DATEONLY, allowNull: false },
  target_price: { type: DataTypes.DECIMAL(10, 2) },
  stop_loss: { type: DataTypes.DECIMAL(10, 2) },
  confidence: { type: DataTypes.FLOAT },
  reason: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'success', 'failed', 'abandoned'), defaultValue: 'active' },
  actual_result: { type: DataTypes.TEXT },
  llm_model: { type: DataTypes.STRING(50) },
  llm_params: { type: DataTypes.JSON }
}, { tableName: 'stock_predictions', timestamps: true, underscored: true });

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

module.exports = { SystemConfig, StockNews, StockPrediction, SimulationAccount, SimulationPosition, DailyGuidance };
