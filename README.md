# FinalStock - A股智能分析系统

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.3-brightgreen" alt="Vue">
  <img src="https://img.shields.io/badge/Node.js-20+-green" alt="Node.js">
  <img src="https://img.shields.io/badge/MariaDB-10.5-blue" alt="MariaDB">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

基于 Vue 3 + Node.js 的 A 股智能分析平台，集成 LLM 选股、回测系统、模拟交易、市场资讯等功能。

## 📌 项目简介

FinalStock 是一款面向个人投资者的智能股票分析工具，通过人工智能技术辅助投资决策。系统提供从新闻资讯获取、AI 选股、策略回测到模拟交易的全流程服务。

### 核心功能

- 📰 **市场资讯** - 自动获取财联社、同花顺、东方财富等财经新闻
- 🧠 **AI 选股** - 基于大语言模型（LLM）智能推荐股票
- 📊 **策略回测** - 支持多种技术指标策略的历史回测
- 💰 **模拟交易** - 虚拟账户实盘演练
- 📈 **技术分析** - K线图、MA、MACD、BOLL、RSI 等指标展示

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + Element Plus + ECharts |
| 后端 | Node.js + Express + Sequelize |
| 数据库 | MariaDB 10.5+ / MySQL 8.0+ |
| 数据源 | Sina、AKShare、Tushare |

## 📋 环境要求

### 最低配置

- **操作系统**: CentOS 7+ / Ubuntu 20+ / Debian 11+
- **Node.js**: v18 或更高版本
- **数据库**: MariaDB 10.5+ / MySQL 8.0+
- **内存**: 2GB RAM
- **磁盘**: 10GB 可用空间

### 开发环境额外需求

- **Git**: 用于代码版本管理
- **npm** 或 **yarn**: 包管理工具
- **PM2** (可选): 进程管理器

## 🚀 快速开始

### 方式一：一键部署（推荐）

```bash
# 完整部署（后端 + 前端 + 数据库）
curl -sSL https://raw.githubusercontent.com/your-repo/finalstock/main/deploy.sh | sudo bash

# 仅部署后端
sudo ./deploy.sh --backend-only
```

### 方式二：手动部署

#### 1. 克隆项目

```bash
git clone https://github.com/your-repo/finalstock.git
cd finalstock
```

#### 2. 初始化数据库

```bash
# 创建数据库和表
mysql -u root -p < database/init.sql

# 或使用 Docker
docker run -d --name finalstock-mariadb \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=openclaw \
  -v ./database/init.sql:/docker-entrypoint-initdb.d/init.sql \
  mariadb:10.5
```

#### 3. 配置后端

```bash
cd backend
npm install

# 复制环境变量文件并修改配置
cp .env.example .env
nano .env  # 编辑数据库连接等配置
```

```env
# backend/.env 示例
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=openclaw
DB_USER=root
DB_PASSWORD=your_password

# LLM 配置（可选）
LLM_API_KEY=your_api_key
LLM_MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
```

```bash
# 启动后端
npm start  # 生产模式
# 或
npm run dev  # 开发模式
```

#### 4. 配置前端

```bash
cd ../frontend
npm install
npm run build
```

构建产物位于 `frontend/dist/`

## 📖 部署指南

### Linux 一键部署

```bash
sudo ./deploy.sh
```

脚本会自动完成：
- 安装 Node.js 20.x
- 安装 MariaDB
- 配置数据库
- 部署后端服务（systemd）

### Docker 部署

```bash
# 1. 复制环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env 配置 LLM_API_KEY 等

# 2. 启动所有服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f
```

访问地址：`http://your-server-ip:3000`

## 📚 API 接口

### 股票数据

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/stocks/list` | GET | 股票列表 |
| `/api/stocks/search` | GET | 股票搜索 |
| `/api/stocks/kline` | GET | K线数据 |
| `/api/stocks/market/overview` | GET | 大盘指数 |

### 新闻资讯

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/news/list` | GET | 新闻列表 |
| `/api/news/sync` | POST | 手动同步新闻 |

### AI 选股

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/prediction/execute` | POST | 执行 LLM 选股 |
| `/api/prediction/confirm` | POST | 确认选股结果 |
| `/api/prediction/list` | GET | 选股记录 |

### 回测系统

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/backtest/run` | POST | 执行回测 |
| `/api/backtest/results` | GET | 回测结果列表 |
| `/api/strategy/list` | GET | 策略列表 |

### 模拟交易

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/simulation/account` | GET | 账户信息 |
| `/api/simulation/buy` | POST | 买入股票 |
| `/api/simulation/sell` | POST | 卖出股票 |
| `/api/simulation/positions` | GET | 持仓列表 |

## 📁 项目结构

```
finalstock/
├── backend/                 # Node.js 后端
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   ├── controllers/    # 控制器
│   │   ├── models/         # 数据模型
│   │   ├── routes/         # 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── strategies/     # 回测策略
│   │   └── utils/          # 工具函数
│   ├── package.json
│   └── .env.example
│
├── frontend/                # Vue 3 前端
│   ├── src/
│   │   ├── api/           # API 调用
│   │   ├── components/    # 组件
│   │   ├── layouts/       # 布局
│   │   ├── router/        # 路由
│   │   └── views/         # 页面视图
│   ├── dist/              # 构建产物
│   └── package.json
│
├── database/               # 数据库脚本
│   └── init.sql           # 初始化脚本
│
├── deploy.sh              # 一键部署脚本
├── docker-compose.yml     # Docker 配置
└── README.md              # 项目文档
```

## ⚙️ 配置说明

### 主要环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 后端服务端口 | `3000` |
| `DB_HOST` | 数据库地址 | `localhost` |
| `DB_PORT` | 数据库端口 | `3306` |
| `DB_NAME` | 数据库名称 | `openclaw` |
| `DB_USER` | 数据库用户 | `root` |
| `DB_PASSWORD` | 数据库密码 | - |
| `LLM_API_KEY` | LLM API 密钥 | - |
| `LLM_MODEL_NAME` | LLM 模型名称 | `Qwen/Qwen2.5-7B-Instruct` |

### 策略参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `short_period` | 短期均线周期 | 5 |
| `long_period` | 长期均线周期 | 20 |
| `rsi_period` | RSI 周期 | 14 |
| `boll_period` | 布林带周期 | 20 |
| `std_dev` | 布林带标准差倍数 | 2 |

## 🔧 常见问题

### Q: 数据库连接失败

A: 检查 `.env` 中的数据库配置，确保 MariaDB/MySQL 已启动且用户权限正确。

### Q: LLM 选股无法使用

A: 需要在系统配置中填写 LLM API Key，当前支持 SiliconFlow 等兼容 OpenAI API 的服务。

### Q: 回测执行缓慢

A: 回测数据量较大时可能需要较长时间，建议先使用少量数据进行测试。

## 📄 许可证

MIT License - 请查看 LICENSE 文件

## 🙏 致谢

- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Element Plus](https://element-plus.org/) - Vue 3 组件库
- [ECharts](https://echarts.apache.org/) - 数据可视化库
- [Sequelize](https://sequelize.org/) - Node.js ORM
- [AKShare](https://akshare.akfamily.xyz/) - A股数据源