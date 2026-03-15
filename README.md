# FinalStock

A股智能分析平台，基于 Vue 3 + Node.js，集成 LLM 选股、策略回测、模拟交易和市场资讯。

## 功能

- 市场资讯 - 自动抓取财联社、东方财富、财新等财经新闻
- AI 选股 - 接入主流 LLM（通义、文心、GLM、Kimi 等）智能推荐股票，支持联网搜索
- 策略回测 - MA、MACD、BOLL、RSI 等技术指标历史回测
- 模拟交易 - 虚拟账户实盘演练
- 技术分析 - K线图及常用指标展示

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + Element Plus + ECharts |
| 后端 | Node.js + Express + Sequelize |
| 数据库 | MariaDB 10.5+ / MySQL 8.0+ |
| 数据源 | Sina、AKShare |

## 快速开始

### 一键部署（Linux）

```bash
sudo ./deploy.sh
```

支持 CentOS / Ubuntu / Debian，脚本自动安装 Node.js、MariaDB，并注册 systemd 服务。

### Docker 部署

```bash
cp backend/.env.example backend/.env
# 编辑 .env，填写 LLM_API_KEY 等配置
docker compose up -d
```

### 手动部署

```bash
git clone https://github.com/fmangela/finalstock.git
cd finalstock

# 初始化数据库
mysql -u root -p < database/init.sql

# 后端
cd backend
npm install
cp .env.example .env  # 编辑配置
node src/index.js

# 前端（开发）
cd ../frontend
npm install
npm run dev
```

前端默认访问地址：`http://localhost:5173/finalstock/`
后端 API 地址：`http://localhost:3000`

## 配置

主要环境变量（`backend/.env`）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 后端端口 | `3000` |
| `DB_HOST` | 数据库地址 | `localhost` |
| `DB_NAME` | 数据库名 | `openclaw` |
| `DB_USER` | 数据库用户 | `openclaw` |
| `DB_PASSWORD` | 数据库密码 | `ocoper` |
| `LLM_PROVIDER` | LLM 提供商 | `siliconflow` |
| `LLM_API_KEY` | LLM API 密钥 | - |
| `LLM_MODEL_NAME` | 模型名称 | `Qwen/Qwen2.5-7B-Instruct` |

LLM 配置也可在系统设置页面动态修改，无需重启服务。

## 项目结构

```
finalstock/
├── backend/
│   └── src/
│       ├── controllers/
│       ├── models/
│       ├── routes/
│       ├── services/
│       └── strategies/
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       └── views/
├── database/
│   └── init.sql
├── deploy.sh
└── docker-compose.yml
```

## 许可证

专有商业软件，版权所有 © 2025 fmangela，保留所有权利。未经授权禁止复制、分发或商业使用。详见 [LICENSE](./LICENSE)。
