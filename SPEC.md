# Final Stock 开发文档

## 1. 项目概述

- **项目名称**: Final Stock - A股智能分析系统
- **项目目录**: `/home/fmangela/finalstock`
- **技术栈**:
  - 前端: Vue 3 + Vite + Element Plus
  - 后端: Node.js + Express + Sequelize
  - 数据库: MariaDB 10.5 (数据库名: openclaw)
  - 数据源: AKShare / BaoStock / Tushare（统一通过服务层与 Python 脚本适配）

---

## 2. 功能模块

### 2.1 市场资讯 (News)
- 每日影响股市的新闻报道
- 新闻来源: 财联社、同花顺、东方财富
- 情感分析评分
- 相关股票关联

### 2.2 A股栏目 (Stock Market)
- 大盘行情绘图 (K线图、分时图)
- 每日A股分析报告
- 实时行情展示

### 2.3 LLM选股 (Prediction)
- 大模型每日选股 (1-10只)
- 设置页面配置选股参数:
  - 换手率阈值
  - PE范围
  - 行业选择
- 已选股票行情记录
- 技术指标预测 (MACD, KDJ, RSI)
- 预测失败可放弃

### 2.4 模拟交易 (Simulation)
- 虚拟账户 (初始资金100万)
- 买入/卖出操作
- 持仓管理
- 盈亏统计

### 2.5 每日指引 (Guidance)
- 每日操作建议 (买入/卖出/持股)
- 风险等级评估
- 重点关注股票

### 2.6 系统设置 (Settings)
- 行情数据源配置 (AKShare/BaoStock/Tushare)
- LLM API 配置
- 新闻源配置
- 选股参数配置

---

## 3. 技术架构

### 3.1 前端结构 (vue-vben-admin 参考)

```
frontend/
├── src/
│   ├── api/           # API 接口
│   ├── components/    # 公共组件
│   ├── layouts/       # 布局组件
│   ├── router/        # 路由配置
│   ├── stores/        # Pinia 状态管理
│   ├── views/         # 页面组件
│   │   ├── home/      # 首页
│   │   ├── stock/     # A股行情
│   │   ├── prediction/# LLM选股
│   │   ├── simulation/# 模拟交易
│   │   ├── news/      # 市场资讯
│   │   └── settings/  # 系统设置
│   └── utils/         # 工具函数
├── index.html
├── vite.config.ts
└── package.json
```

### 3.2 后端结构

```
backend/
├── src/
│   ├── config/        # 配置文件
│   ├── controllers/   # 控制器
│   ├── middleware/    # 中间件
│   ├── models/        # 数据模型
│   ├── routes/        # 路由
│   ├── services/      # 业务逻辑
│   │   └── providers/ # 数据源适配器
│   │       ├── AKShareProvider.js
│   │       ├── BaoStockProvider.js
│   │       └── TushareProvider.js
│   ├── utils/         # 工具函数
│   └── index.js       # 入口文件
├── package.json
└── .env
```

### 3.3 数据库设计

```sql
-- 系统配置表
CREATE TABLE system_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_group VARCHAR(50),
  config_key VARCHAR(100),
  config_value TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE
);

-- 股票新闻表
CREATE TABLE stock_news (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(500),
  content TEXT,
  source VARCHAR(50),
  pub_date DATETIME,
  sentiment_score FLOAT,
  related_stocks JSON,
  importance INT DEFAULT 1
);

-- 大模型选股记录
CREATE TABLE stock_predictions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stock_code VARCHAR(10),
  stock_name VARCHAR(50),
  stockup_date DATETIME,
  target_price DECIMAL(10,2),
  stop_loss DECIMAL(10,2),
  confidence FLOAT,
  reason TEXT,
  status ENUM('active','success','failed','abandoned','expired'),
  actual_result TEXT,
  llm_model VARCHAR(50),
  llm_params JSON
);

-- 模拟账户
CREATE TABLE simulation_account (
  id INT PRIMARY KEY AUTO_INCREMENT,
  initial_capital DECIMAL(15,2) DEFAULT 1000000,
  current_capital DECIMAL(15,2),
  total_profit_loss DECIMAL(15,2) DEFAULT 0,
  total_trades INT DEFAULT 0,
  win_trades INT DEFAULT 0
);

-- 模拟持仓
CREATE TABLE simulation_positions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  prediction_id INT,
  stock_code VARCHAR(10),
  stock_name VARCHAR(50),
  buy_date DATE,
  buy_price DECIMAL(10,2),
  shares INT,
  current_price DECIMAL(10,2),
  status ENUM('holding','sold'),
  sell_date DATE,
  sell_price DECIMAL(10,2),
  profit_loss DECIMAL(10,2)
);

-- 每日操作指引
CREATE TABLE daily_guidance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  trade_date DATE UNIQUE,
  market_overall VARCHAR(20),
  guidance TEXT,
  risk_level INT DEFAULT 3,
  key_stocks JSON,
  analysis_summary TEXT
);
```

---

## 4. API 接口设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/stocks/list | 股票列表 |
| GET | /api/stocks/:code/quote | 实时行情 |
| GET | /api/stocks/:code/history | 历史K线 |
| GET | /api/stocks/market/overview | 大盘概览 |
| GET | /api/news/list | 新闻列表 |
| GET | /api/prediction/list | 预测列表 |
| POST | /api/prediction/generate | 生成预测 |
| POST | /api/prediction/:id/abandon | 放弃预测 |
| GET | /api/simulation/account | 账户信息 |
| GET | /api/simulation/positions | 持仓列表 |
| POST | /api/simulation/buy | 买入 |
| POST | /api/simulation/sell | 卖出 |
| GET | /api/analysis/guidance/today | 今日指引 |
| GET | /api/config/all | 所有配置 |
| POST | /api/config/save | 保存配置 |

---

## 5. 开发流程

### 步骤1: 项目初始化
- 创建项目目录结构
- 初始化前后端依赖

### 步骤2: 后端开发
- 数据库连接配置
- 数据模型定义
- 路由和控制器
- 数据源 Provider 实现

### 步骤3: 前端开发
- 基于 vue-vben-admin 模板
- 页面组件开发
- API 对接

---

## 6. 当前实现补充

- 当前仓库包含 `backend/tests/` 基础测试目录，已覆盖指标、策略和部分校验逻辑。
- 自动流程、策略回测、新版模拟交易任务页均已落地，不再只是设计预留。
- 启动阶段已增加 schema 兼容性检查，用于在数据库字段缺失或枚举不一致时快速失败。

### 步骤4: 部署配置
- 开机自启配置（systemd）

---

## 6. 参考资源

- **前端模板**: https://github.com/vbenjs/vue-vben-admin
- **A股分析参考**: https://github.com/DR-lin-eng/stock-scanner
- **数据源 AKShare**: https://github.com/akfamily/akshare
- **BaoStock**: http://www.baostock.com/
- **Tushare**: https://tushare.pro/

---

## 7. 注意事项

1. **数据库**: 使用已有的 openclaw 数据库，保留其他表
2. **数据源**: 优先使用 AKShare (完全免费)
3. **LLM**: 通过设置页面配置 API
4. **端口**: 后端 3000，前端开发 5173
5. **路径**: 访问路径 /finalstock/
