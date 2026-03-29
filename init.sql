-- Final Stock 数据库初始化脚本（兼容版）
-- 说明：推荐优先使用 database/init.sql，本文件用于快速初始化的兼容场景

USE openclaw;

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_group VARCHAR(50) NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_group_key (config_group, config_key)
);

-- 股票新闻表
CREATE TABLE IF NOT EXISTS stock_news (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  source VARCHAR(50),
  source_url VARCHAR(500),
  pub_date DATETIME,
  sentiment_score FLOAT DEFAULT 0,
  related_stocks JSON,
  importance INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 提示词配置表
CREATE TABLE IF NOT EXISTS stock_prompts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  market_type VARCHAR(20) DEFAULT 'A股',
  push_news BOOLEAN DEFAULT FALSE,
  push_stock_info BOOLEAN DEFAULT FALSE,
  output_format TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 大模型选股记录
CREATE TABLE IF NOT EXISTS stock_predictions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stock_code VARCHAR(10) NOT NULL,
  stock_name VARCHAR(50),
  stockup_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  target_price DECIMAL(10,2),
  stop_loss DECIMAL(10,2),
  confidence FLOAT,
  reason TEXT,
  status ENUM('active','success','failed','abandoned','expired') DEFAULT 'active',
  actual_result TEXT,
  llm_model VARCHAR(50),
  llm_params JSON,
  observation_period VARCHAR(20),
  llm_response TEXT,
  prompt_id INT,
  prompt_name VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 模拟账户
CREATE TABLE IF NOT EXISTS simulation_account (
  id INT PRIMARY KEY AUTO_INCREMENT,
  initial_capital DECIMAL(15,2) DEFAULT 1000000.00,
  current_capital DECIMAL(15,2) DEFAULT 1000000.00,
  total_profit_loss DECIMAL(15,2) DEFAULT 0.00,
  total_trades INT DEFAULT 0,
  win_trades INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 模拟持仓
CREATE TABLE IF NOT EXISTS simulation_positions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  prediction_id INT,
  stock_code VARCHAR(10) NOT NULL,
  stock_name VARCHAR(50),
  buy_date DATE NOT NULL,
  buy_price DECIMAL(10,2) NOT NULL,
  shares INT NOT NULL,
  current_price DECIMAL(10,2),
  status ENUM('holding','sold') DEFAULT 'holding',
  sell_date DATE,
  sell_price DECIMAL(10,2),
  profit_loss DECIMAL(10,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 每日操作指引
CREATE TABLE IF NOT EXISTS daily_guidance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  trade_date DATE UNIQUE NOT NULL,
  market_overall VARCHAR(20),
  guidance TEXT,
  risk_level INT DEFAULT 3,
  key_stocks JSON,
  analysis_summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 应用日志（与 Sequelize 模型字段保持一致）
CREATE TABLE IF NOT EXISTS app_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  level VARCHAR(10) DEFAULT 'info',
  source VARCHAR(50),
  message VARCHAR(500),
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化模拟账户
INSERT IGNORE INTO simulation_account (id, initial_capital, current_capital) VALUES (1, 1000000.00, 1000000.00);

-- 初始化默认配置
INSERT IGNORE INTO system_configs (config_group, config_key, config_value) VALUES
('data_source', 'provider', 'akshare'),
('llm_config', 'api_url', ''),
('llm_config', 'api_key', ''),
('llm_config', 'model_name', ''),
('stock_filter', 'turnover_rate_min', '2'),
('stock_filter', 'turnover_rate_max', '20'),
('stock_filter', 'pe_min', '5'),
('stock_filter', 'pe_max', '50'),
('stock_filter', 'industries', '[]'),
('news', 'sources', '["eastmoney","cls","cx"]'),
('news', 'retention_days', '7'),
('news', 'sync_enabled', '0'),
('news', 'sync_period_type', 'hour'),
('news', 'sync_period_value', '6'),
('news', 'sync_start_time', '0'),
('news', 'sync_end_time', '0'),
('news', 'sync_cron_expr', '0 */6 * * *');
