-- ============================================
-- FinalStock 数据库初始化脚本
-- 数据库: openclaw
-- 字符集: utf8mb4
-- ============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `openclaw` 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `openclaw`;

-- ============================================
-- 1. 系统配置表
-- ============================================
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `config_group` VARCHAR(50) NOT NULL COMMENT '配置分组',
  `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
  `config_value` TEXT COMMENT '配置值',
  `is_encrypted` TINYINT(1) DEFAULT 0 COMMENT '是否加密',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_key` (`config_group`, `config_key`),
  INDEX idx_group (`config_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- ============================================
-- 2. 股票新闻表
-- ============================================
CREATE TABLE IF NOT EXISTS `stock_news` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(500) NOT NULL COMMENT '标题',
  `content` TEXT COMMENT '内容',
  `source` VARCHAR(50) COMMENT '来源',
  `source_url` VARCHAR(500) COMMENT '来源URL',
  `pub_date` DATETIME COMMENT '发布日期',
  `sentiment_score` FLOAT DEFAULT 0 COMMENT '情感分数',
  `related_stocks` JSON COMMENT '关联股票',
  `importance` INT DEFAULT 1 COMMENT '重要程度 1-5',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX idx_pub_date (`pub_date`),
  INDEX idx_title (`title`(200)),
  INDEX idx_importance (`importance`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='股票新闻表';

-- ============================================
-- 3. 股票预测表
-- ============================================
CREATE TABLE IF NOT EXISTS `stock_predictions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `stock_code` VARCHAR(10) NOT NULL COMMENT '股票代码',
  `stock_name` VARCHAR(50) COMMENT '股票名称',
  `stockup_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '选股日期',
  `target_price` DECIMAL(10,2) COMMENT '目标价',
  `stop_loss` DECIMAL(10,2) COMMENT '止损价',
  `confidence` FLOAT COMMENT '置信度',
  `reason` TEXT COMMENT '选股理由',
  `status` ENUM('active','success','failed','abandoned','expired') DEFAULT 'active' COMMENT '状态',
  `actual_result` TEXT COMMENT '实际结果',
  `llm_model` VARCHAR(50) COMMENT '使用的模型',
  `llm_params` JSON COMMENT '模型参数',
  `observation_period` VARCHAR(20) DEFAULT '一月' COMMENT '观察周期',
  `llm_response` TEXT COMMENT 'LLM响应',
  `prompt_id` INT COMMENT '提示词ID',
  `prompt_name` VARCHAR(100) COMMENT '提示词名称',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX idx_stock_code (`stock_code`),
  INDEX idx_status (`status`),
  INDEX idx_stockup_date (`stockup_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='股票预测表';

-- ============================================
-- 4. 股票提示词表
-- ============================================
CREATE TABLE IF NOT EXISTS `stock_prompts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '提示词名称',
  `content` TEXT NOT NULL COMMENT '提示词内容',
  `market_type` VARCHAR(20) DEFAULT 'A股' COMMENT '市场类型',
  `push_news` TINYINT(1) DEFAULT 0 COMMENT '推送新闻',
  `push_stock_info` TINYINT(1) DEFAULT 0 COMMENT '推送股票信息',
  `output_format` TEXT COMMENT '输出格式要求',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='股票提示词表';

-- ============================================
-- 5. 模拟账户表
-- ============================================
CREATE TABLE IF NOT EXISTS `simulation_account` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `initial_capital` DECIMAL(15,2) DEFAULT 1000000 COMMENT '初始资金',
  `current_capital` DECIMAL(15,2) DEFAULT 1000000 COMMENT '当前资金',
  `total_profit_loss` DECIMAL(15,2) DEFAULT 0 COMMENT '总盈亏',
  `total_trades` INT DEFAULT 0 COMMENT '总交易次数',
  `win_trades` INT DEFAULT 0 COMMENT '盈利次数',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模拟账户表';

-- 插入默认账户数据
INSERT INTO `simulation_account` (`id`, `initial_capital`, `current_capital`) 
VALUES (1, 1000000.00, 1000000.00)
ON DUPLICATE KEY UPDATE `id` = `id`;

-- ============================================
-- 6. 模拟持仓表
-- ============================================
CREATE TABLE IF NOT EXISTS `simulation_positions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `prediction_id` INT COMMENT '预测ID',
  `stock_code` VARCHAR(10) NOT NULL COMMENT '股票代码',
  `stock_name` VARCHAR(50) COMMENT '股票名称',
  `buy_date` DATE NOT NULL COMMENT '买入日期',
  `buy_price` DECIMAL(10,2) NOT NULL COMMENT '买入价格',
  `shares` INT NOT NULL COMMENT '持股数量',
  `current_price` DECIMAL(10,2) COMMENT '当前价格',
  `status` ENUM('holding','sold') DEFAULT 'holding' COMMENT '状态',
  `sell_date` DATE COMMENT '卖出日期',
  `sell_price` DECIMAL(10,2) COMMENT '卖出价格',
  `profit_loss` DECIMAL(10,2) COMMENT '盈亏',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX idx_stock_code (`stock_code`),
  INDEX idx_status (`status`),
  INDEX idx_buy_date (`buy_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模拟持仓表';

-- ============================================
-- 7. 每日指导表
-- ============================================
CREATE TABLE IF NOT EXISTS `daily_guidance` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `trade_date` DATE NOT NULL COMMENT '交易日期',
  `market_overall` VARCHAR(20) COMMENT '市场整体状况',
  `guidance` TEXT COMMENT '指导建议',
  `risk_level` INT DEFAULT 3 COMMENT '风险等级 1-5',
  `key_stocks` JSON COMMENT '重点股票',
  `analysis_summary` TEXT COMMENT '分析总结',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_trade_date` (`trade_date`),
  INDEX idx_risk_level (`risk_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日指导表';

-- ============================================
-- 8. 回测配置表
-- ============================================
CREATE TABLE IF NOT EXISTS `backtest_configs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '配置名称',
  `stock_code` VARCHAR(10) NOT NULL COMMENT '股票代码',
  `stock_name` VARCHAR(50) COMMENT '股票名称',
  `start_date` DATE NOT NULL COMMENT '开始日期',
  `end_date` DATE NOT NULL COMMENT '结束日期',
  `initial_capital` DECIMAL(15,2) DEFAULT 100000 COMMENT '初始资金',
  `buy_strategy` TEXT COMMENT '买入策略',
  `sell_strategy` TEXT COMMENT '卖出策略',
  `params` JSON COMMENT '参数配置',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX idx_stock_code (`stock_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='回测配置表';

-- ============================================
-- 9. 回测结果表
-- ============================================
CREATE TABLE IF NOT EXISTS `backtest_results` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `config_id` INT COMMENT '配置ID',
  `stock_code` VARCHAR(10) NOT NULL COMMENT '股票代码',
  `stock_name` VARCHAR(50) COMMENT '股票名称',
  `start_date` DATE NOT NULL COMMENT '开始日期',
  `end_date` DATE NOT NULL COMMENT '结束日期',
  `initial_capital` DECIMAL(15,2) NOT NULL COMMENT '初始资金',
  `final_capital` DECIMAL(15,2) NOT NULL COMMENT '最终资金',
  `total_return` DECIMAL(10,4) COMMENT '总收益率',
  `annual_return` DECIMAL(10,4) COMMENT '年化收益率',
  `max_drawdown` DECIMAL(10,4) COMMENT '最大回撤',
  `win_rate` DECIMAL(10,4) COMMENT '胜率',
  `total_trades` INT DEFAULT 0 COMMENT '总交易次数',
  `profit_trades` INT DEFAULT 0 COMMENT '盈利次数',
  `loss_trades` INT DEFAULT 0 COMMENT '亏损次数',
  `sharpe_ratio` DECIMAL(10,4) COMMENT '夏普比率',
  `trades_json` JSON COMMENT '交易记录',
  `equity_curve` JSON COMMENT '权益曲线',
  `monthly_returns` JSON COMMENT '月度收益',
  `kline_data` JSON COMMENT 'K线数据',
  `buy_points` JSON COMMENT '买入点',
  `sell_points` JSON COMMENT '卖出点',
  `ma5` JSON COMMENT 'MA5数据',
  `ma20` JSON COMMENT 'MA20数据',
  `rsi` JSON COMMENT 'RSI数据',
  `macd` JSON COMMENT 'MACD数据',
  `signal` JSON COMMENT '信号数据',
  `boll_upper` JSON COMMENT '布林上轨',
  `boll_lower` JSON COMMENT '布林下轨',
  `strategy_id` INT COMMENT '策略ID',
  `strategy_instance_id` INT COMMENT '策略实例ID',
  `strategy_params_json` JSON COMMENT '策略参数',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX idx_stock_code (`stock_code`),
  INDEX idx_dates (`start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='回测结果表';

-- ============================================
-- 10. 回测策略表
-- ============================================
CREATE TABLE IF NOT EXISTS `backtest_strategies` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '策略名称',
  `description` TEXT COMMENT '策略描述',
  `strategy_type` VARCHAR(50) NOT NULL COMMENT '策略类型',
  `category` VARCHAR(50) DEFAULT '技术指标' COMMENT '分类',
  `is_system` TINYINT(1) DEFAULT 1 COMMENT '是否系统策略',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='回测策略表';

-- 插入默认策略
INSERT INTO `backtest_strategies` (`name`, `description`, `strategy_type`, `category`) VALUES
('MA交叉策略', '简单移动平均线金叉死叉策略', 'ma', '技术指标'),
('MACD策略', 'MACD指标策略', 'macd', '技术指标'),
('布林带策略', '布林带突破策略', 'boll', '技术指标'),
('RSI策略', 'RSI超买超卖策略', 'rsi', '技术指标'),
('突破策略', 'N日高低点突破策略', 'breakout', '技术指标')
ON DUPLICATE KEY UPDATE `id` = `id`;

-- ============================================
-- 11. 策略参数表
-- ============================================
CREATE TABLE IF NOT EXISTS `strategy_params` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `strategy_id` INT NOT NULL COMMENT '策略ID',
  `param_name` VARCHAR(50) NOT NULL COMMENT '参数名',
  `param_label` VARCHAR(100) NOT NULL COMMENT '参数标签',
  `param_type` VARCHAR(20) DEFAULT 'number' COMMENT '参数类型',
  `default_value` VARCHAR(100) COMMENT '默认值',
  `min_value` DECIMAL(10,2) COMMENT '最小值',
  `max_value` DECIMAL(10,2) COMMENT '最大值',
  `step` DECIMAL(10,2) DEFAULT 1 COMMENT '步长',
  `options` JSON COMMENT '可选值',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX idx_strategy_id (`strategy_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略参数表';

-- ============================================
-- 12. 策略实例表
-- ============================================
CREATE TABLE IF NOT EXISTS `strategy_instances` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '实例名称',
  `strategy_id` INT NOT NULL COMMENT '策略ID',
  `params_json` JSON NOT NULL COMMENT '参数JSON',
  `description` TEXT COMMENT '描述',
  `is_favorite` TINYINT(1) DEFAULT 0 COMMENT '是否收藏',
  `use_count` INT DEFAULT 0 COMMENT '使用次数',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX idx_strategy_id (`strategy_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略实例表';

-- ============================================
-- 13. 应用日志表
-- ============================================
CREATE TABLE IF NOT EXISTS `app_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `level` VARCHAR(10) DEFAULT 'info' COMMENT '日志级别',
  `source` VARCHAR(50) COMMENT '来源模块',
  `message` VARCHAR(500) COMMENT '消息',
  `content` TEXT COMMENT '详情',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX idx_level (`level`),
  INDEX idx_source (`source`),
  INDEX idx_created_at (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应用日志表';

-- ============================================
-- 默认系统配置
-- ============================================
INSERT INTO `system_configs` (`config_group`, `config_key`, `config_value`) VALUES
-- 新闻同步配置
('news', 'sync_enabled', '1'),
('news', 'sync_period_type', 'hour'),
('news', 'sync_period_value', '6'),
('news', 'retention_days', '7'),
-- LLM配置
('llm_config', 'provider', 'siliconflow'),
('llm_config', 'api_url', 'https://api.siliconflow.cn/v1/chat/completions'),
('llm_config', 'model_name', 'Qwen/Qwen2.5-7B-Instruct'),
-- 日志配置
('logging', 'enabled', '1')
ON DUPLICATE KEY UPDATE `config_value` = VALUES(`config_value`);

-- ============================================
-- 默认提示词
-- ============================================
INSERT INTO `stock_prompts` (`name`, `content`, `market_type`, `push_news`, `push_stock_info`) VALUES
('智能选股助手', '请根据以下条件推荐股票：\n1. 行业前景好\n2. 业绩稳定增长\n3. 估值合理\n\n请推荐3-5只符合条件的股票，并说明理由。', 'A股', 1, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `content` = VALUES(`content`), `updated_at` = CURRENT_TIMESTAMP;

-- ============================================
-- 14. K线历史缓存表
-- ============================================
CREATE TABLE IF NOT EXISTS `stock_kline_cache` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `stock_code` VARCHAR(10) NOT NULL COMMENT '股票代码',
  `trade_date` DATE NOT NULL COMMENT '交易日期',
  `open`   DECIMAL(10,3) NOT NULL COMMENT '开盘价',
  `close`  DECIMAL(10,3) NOT NULL COMMENT '收盘价',
  `high`   DECIMAL(10,3) NOT NULL COMMENT '最高价',
  `low`    DECIMAL(10,3) NOT NULL COMMENT '最低价',
  `volume` BIGINT DEFAULT 0 COMMENT '成交量（手）',
  `amount` DECIMAL(20,2) DEFAULT 0 COMMENT '成交额（元）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code_date` (`stock_code`, `trade_date`),
  INDEX idx_stock_code (`stock_code`),
  INDEX idx_trade_date (`trade_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='股票K线历史缓存表';

-- ============================================
-- 15. 模拟交易任务表
-- ============================================
CREATE TABLE IF NOT EXISTS `sim_tasks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `stock_code`      VARCHAR(10) NOT NULL COMMENT '股票代码',
  `stock_name`      VARCHAR(50) COMMENT '股票名称',
  `initial_capital` DECIMAL(15,2) NOT NULL DEFAULT 100000 COMMENT '初始资金',
  `cash_balance`    DECIMAL(15,2) NOT NULL DEFAULT 100000 COMMENT '当前现金',
  `shares`          INT NOT NULL DEFAULT 0 COMMENT '当前持股数量',
  `avg_cost`        DECIMAL(10,3) DEFAULT 0 COMMENT '持仓均价',
  `strategy_type`   VARCHAR(20) NOT NULL DEFAULT 'ma' COMMENT '策略类型',
  `strategy_params` JSON COMMENT '策略参数',
  `trade_timing`    ENUM('pre_open','pre_close') DEFAULT 'pre_close' COMMENT '交易时机：盘前/收盘前',
  `status`          ENUM('running','paused','stopped') DEFAULT 'running' COMMENT '任务状态',
  `last_run_date`   DATE COMMENT '最近执行日期',
  `total_return`    DECIMAL(10,4) DEFAULT 0 COMMENT '总收益率(%)',
  `max_drawdown`    DECIMAL(10,4) DEFAULT 0 COMMENT '最大回撤(%)',
  `total_trades`    INT DEFAULT 0 COMMENT '总交易次数',
  `win_trades`      INT DEFAULT 0 COMMENT '盈利次数',
  `peak_value`      DECIMAL(15,2) DEFAULT 0 COMMENT '历史最高总资产（用于计算最大回撤）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX idx_stock_code (`stock_code`),
  INDEX idx_status (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模拟交易任务表';

-- ============================================
-- 16. 模拟交易记录表
-- ============================================
CREATE TABLE IF NOT EXISTS `sim_trades` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `task_id`       INT NOT NULL COMMENT '任务ID',
  `trade_date`    DATE NOT NULL COMMENT '交易日期',
  `type`          ENUM('buy','sell') NOT NULL COMMENT '买入/卖出',
  `price`         DECIMAL(10,3) NOT NULL COMMENT '成交价（含滑点）',
  `raw_price`     DECIMAL(10,3) COMMENT '信号触发时原始价格',
  `shares`        INT NOT NULL COMMENT '成交股数',
  `amount`        DECIMAL(15,2) NOT NULL COMMENT '成交金额',
  `slippage`      DECIMAL(10,4) DEFAULT 0 COMMENT '滑点金额',
  `signal_reason` VARCHAR(200) COMMENT '信号原因',
  `is_limit_up`   TINYINT(1) DEFAULT 0 COMMENT '是否涨停',
  `is_limit_down` TINYINT(1) DEFAULT 0 COMMENT '是否跌停',
  `cash_before`   DECIMAL(15,2) COMMENT '交易前现金',
  `cash_after`    DECIMAL(15,2) COMMENT '交易后现金',
  `profit_loss`   DECIMAL(15,2) DEFAULT 0 COMMENT '本次盈亏（卖出时计算）',
  `hold_days`     INT DEFAULT 0 COMMENT '持仓天数（卖出时计算）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX idx_task_id (`task_id`),
  INDEX idx_trade_date (`trade_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模拟交易记录表';

-- ============================================
-- 完成
-- ============================================
SELECT '数据库初始化完成!' AS result;
