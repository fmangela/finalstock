# 大模型选股模块重构 - 技术文档

## 1. 需求概述

- 手动选股：点击"AI选股"按钮，弹窗配置后执行
- 自动选股：框架预留，暂不实现
- 选股流程：选择模型 → 选择提示词 → 执行 → 匹配股票 → 确认选股

## 2. 数据库设计

### 2.1 提示词配置表 (stock_prompts)

```sql
CREATE TABLE IF NOT EXISTS stock_prompts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  market_type VARCHAR(20) DEFAULT 'A股',
  push_news BOOLEAN DEFAULT FALSE,
  push_stock_info BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2.2 选股记录表 (已有 stock_predictions)

需新增字段：
- `observation_period` VARCHAR(20) -- 观测周期：一周、一月、一年
- `llm_response` TEXT -- 大模型原始回复
- `prompt_id` INT -- 使用的提示词ID
- `prompt_name` VARCHAR(100) -- 提示词名称（冗余）

### 2.3 大模型配置 (system_configs)

```sql
-- 大模型配置组
('llm_config', 'api_url', '')  
('llm_config', 'api_key', '')
('llm_config', 'model_name', '')

-- 支持的国内大模型列表（预定义）:
-- - 百度文心一言: https://qianfan.baidubce.com/v2/chat/completions
-- - 阿里通义千问: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
-- - 智谱GLM: https://open.bigmodel.cn/api/paas/v4/chat/completions
-- - 腾讯混元: https://hunyuan.cloud.tencent.com/api/v3/chat/completions
-- - 月之暗面(Moonshot): https://api.moonshot.cn/v1/chat/completions
-- - 百川智能: https://api.baichuan-ai.com/v1/chat/completions
-- - 商汤日日新: https://api.sensetime.com/v1/chat/completions
```

## 3. 后端API设计

### 3.1 提示词管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/prompts/list | 获取提示词列表 |
| POST | /api/prompts | 新增提示词 |
| PUT | /api/prompts/:id | 修改提示词 |
| DELETE | /api/prompts/:id | 删除提示词 |

### 3.2 大模型配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/llm-config/get | 获取当前配置 |
| POST | /api/llm-config/save | 保存配置 |
| POST | /api/llm-config/test | 测试连接 |

### 3.3 选股执行

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/prediction/execute | 执行选股，返回匹配股票 |

## 4. 前端页面设计

### 4.1 设置页面 - LLM配置标签页

- 大模型选择下拉框（预定义热门模型）
- API URL 输入框
- API Key 输入框
- 模型名称输入框
- 保存按钮 → 气泡提示"保存成功"
- 测试按钮 → 调用测试API，提示成功/失败

### 4.2 设置页面 - 提示词管理

- 提示词列表（表格）
- 新增/编辑/删除按钮
- 新增/编辑弹窗：
  - 名称输入
  - 内容输入（多行文本）
  - 匹配股市（默认"A股"）
  - 推送要闻复选框
  - 推送股市信息复选框

### 4.3 选股页面

- "AI选股"按钮 → 弹出选股对话框
- 选股对话框：
  - 大模型下拉选择（从配置读取）
  - 提示词下拉选择（从提示词表读取）
  - 确定按钮 → 调用API → 显示结果
  - 取消按钮 → 关闭对话框
- 选股结果区域：
  - 文本框显示大模型原始回复
  - 匹配股票表格：代码、名称、走势、观测周期
  - 每行复选框 → 选中要确认的股票
  - "确认选股"按钮 → 保存到数据库 → 关闭对话框

## 5. 选股流程

```
用户点击"AI选股"
    ↓
弹出对话框 → 选择大模型 + 提示词
    ↓
点击"确定" → 调用 /api/prediction/execute
    ↓
大模型返回选股建议 → 程序匹配股票代码和名称
    ↓
显示原始回复 + 匹配结果表格
    ↓
用户勾选要确认的股票 → 点击"确认选股"
    ↓
保存到 stock_predictions → 关闭对话框
```

## 6. 大模型响应格式要求

提示词需要求大模型返回以下格式（JSON）：

```json
{
  "stocks": [
    {
      "code": "600519",
      "name": "贵州茅台",
      "trend": "上涨",
      "reason": "理由..."
    }
  ],
  "analysis": "整体分析..."
}
```

## 7. 实现步骤

1. 创建提示词表，添加选股票段
2. 实现提示词CRUD API
3. 实现大模型配置和测试API
4. 实现选股执行API
5. 前端：设置页面添加LLM配置和提示词管理
6. 前端：选股页面重构，添加AI选股对话框
7. 测试