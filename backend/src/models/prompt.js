const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockPrompt = sequelize.define('StockPrompt', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  market_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'A股'
  },
  push_news: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  push_stock_info: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'stock_prompts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = StockPrompt;