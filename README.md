# Final Stock - A股智能分析系统

基于 Vue 3 + Node.js 的 A 股智能分析平台，集成 LLM 选股、模拟交易、市场资讯等功能。

## 技术栈

- **前端**: Vue 3 + Vite + Element Plus + ECharts
- **后端**: Node.js + Express + Sequelize
- **数据库**: MariaDB 10.5 (数据库名: `openclaw`)
- **数据源**: AKShare (Python)

## 功能模块

| 模块 | 说明 |
|------|------|
| 首页 | 大盘指数、今日指引、模拟账户概览 |
| A股行情 | 股票列表、K线图、涨跌排行 |
| 市场资讯 | 财联社/同花顺/东方财富新闻、情感分析 |
| LLM选股 | 大模型每日选股、预测记录管理 |
| 模拟交易 | 虚拟账户（初始100万）、买卖操作、持仓管理 |
| 系统设置 | 数据源、LLM API、选股参数配置 |

## 快速开始

### 1. 初始化数据库

```bash
mysql -u root -p openclaw < init.sql
```

### 2. 启动后端

```bash
cd backend
npm install
cp .env.example .env   # 配置数据库连接
npm start              # 生产模式，端口 3000
# 或
npm run dev            # 开发模式（nodemon）
```

### 3. 前端开发

```bash
cd frontend
npm install
npm run dev            # 开发服务器，端口 5173
npm run build          # 构建到 frontend/dist/
```

## 生产部署

### Nginx

将 `nginx.conf` 复制到 Nginx 配置目录，修改 `root` 路径后启用：

```bash
sudo cp nginx.conf /etc/nginx/sites-available/finalstock
sudo ln -s /etc/nginx/sites-available/finalstock /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

访问地址: `http://your-server/finalstock/`

### 目录结构

```
finalstock/
├── backend/          # Node.js 后端
│   └── src/
│       ├── controllers/
│       ├── models/
│       ├── routes/
│       └── services/
├── frontend/         # Vue 3 前端
│   ├── src/
│   │   ├── api/
│   │   ├── layouts/
│   │   ├── router/
│   │   └── views/
│   └── dist/         # 构建产物
├── init.sql          # 数据库初始化脚本
├── nginx.conf        # Nginx 配置模板
└── SPEC.md           # 开发文档
```

## 环境变量 (backend/.env)

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=openclaw
DB_USER=root
DB_PASS=your_password
PORT=3000
```
