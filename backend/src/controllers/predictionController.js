// AI 选股控制器
// 核心流程：读取提示词 → 可选附加要闻/大盘数据 → 调用 LLM → 解析返回结果
// 用户确认后批量保存到 stock_predictions 表进行后续跟踪
const axios = require('axios');
const sequelize = require('../config/database');
const { StockPrediction, StockPrompt, StockNews, SystemConfig } = require('../models');

// 根据 provider 构建 LLM 请求体，各家 web search 参数格式不同
function buildLlmRequest({ provider, model_name, systemMsg, userMsg, webSearchEnabled }) {
  const messages = [
    { role: 'system', content: systemMsg },
    { role: 'user', content: userMsg }
  ];
  const base = { model: model_name, messages, temperature: 0.7 };

  if (!webSearchEnabled) return base;

  switch (provider) {
    // 阿里通义千问：顶层字段 enable_search
    case 'qwen':
      return { ...base, enable_search: true };

    // 百度文心一言：默认开启，disable_search:false 明确启用
    case 'ernie':
      return { ...base, disable_search: false, enable_citation: false };

    // 智谱GLM：tools 数组传入 web_search 工具
    case 'glm':
      return {
        ...base,
        tools: [{
          type: 'web_search',
          web_search: { enable: 'True', search_result: 'True', count: '5' }
        }]
      };

    // 腾讯混元：顶层字段 enable_search（OpenAI 兼容接口）
    case 'hunyuan':
      return { ...base, enable_search: true };

    // 月之暗面 Kimi K2：tools 传入内置 $web_search 工具
    case 'moonshot':
      return {
        ...base,
        tools: [{
          type: 'builtin_function',
          function: { name: '$web_search' }
        }]
      };

    // 百川：顶层字段 with_search_enhance
    case 'baichuan':
      return { ...base, with_search_enhance: true };

    // SiliconFlow / DeepSeek / 其他：不支持内置联网，直接返回基础请求
    default:
      return base;
  }
}

// 获取选股记录列表，支持按状态过滤和多字段排序
exports.getList = async (req, res) => {
  try {
    const { status, page = 1, pageSize = 20, sortField, sortOrder } = req.query;
    const where = status ? { status } : {};

    // 排序字段映射：stock_code 需转为数字排序，避免字符串排序导致顺序错误
    const fieldMap = {
      stock_code:         sequelize.literal('CAST(stock_code AS UNSIGNED)'),
      stock_name:         'stock_name',
      stockup_date:       'stockup_date',
      observation_period: 'observation_period',
      prompt_name:        'prompt_name',
      llm_model:          'llm_model',
      confidence:         'confidence',
      status:             'status'
    };

    const orderField = fieldMap[sortField] || 'stockup_date';
    const orderDirection = sortOrder === 'ascending' ? 'ASC' : 'DESC';

    const { count, rows } = await StockPrediction.findAndCountAll({
      where,
      order: [[orderField, orderDirection]],
      limit: +pageSize,
      offset: (+page - 1) * +pageSize
    });
    res.json({ code: 0, data: { total: count, list: rows } });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 手动新增一条选股记录（不经过 LLM，直接由用户填写）
exports.generate = async (req, res) => {
  try {
    const { stock_code, stock_name, target_price, stop_loss, confidence, reason, llm_model, llm_params } = req.body;
    const prediction = await StockPrediction.create({
      stock_code,
      stock_name,
      stockup_date: new Date(),
      target_price,
      stop_loss,
      confidence,
      reason,
      status: 'active',
      llm_model,
      llm_params
    });
    res.json({ code: 0, data: prediction });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 放弃跟踪某条选股记录（状态改为 abandoned）
exports.abandon = async (req, res) => {
  try {
    const { id } = req.params;
    const prediction = await StockPrediction.findByPk(id);
    if (!prediction) return res.status(404).json({ code: 404, message: '预测记录不存在' });
    await prediction.update({ status: 'abandoned' });
    res.json({ code: 0, message: '已放弃' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 手动更新选股状态（success / failed / abandoned）及实际结果备注
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actual_result } = req.body;
    const prediction = await StockPrediction.findByPk(id);
    if (!prediction) return res.status(404).json({ code: 404, message: '预测记录不存在' });
    await prediction.update({ status, actual_result });
    res.json({ code: 0, data: prediction });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 执行 AI 选股：调用大模型，返回推荐股票列表（仅返回，不保存）
// 流程：读取 LLM 配置 → 读取提示词 → 可选附加要闻/大盘 → 调用 API → 解析 JSON
exports.execute = async (req, res) => {
  try {
    const { prompt_id, observation_period } = req.body;

    // 读取大模型配置（provider / api_url / api_key / model_name）
    const configs = await SystemConfig.findAll({ where: { config_group: 'llm_config' } });
    const cfg = {};
    configs.forEach(c => { cfg[c.config_key] = c.config_value; });
    const { provider, api_url, api_key, model_name } = cfg;
    if (!api_key || !model_name) {
      return res.json({ code: 1, message: '请先在设置中配置大模型参数' });
    }

    // 读取提示词模板
    const prompt = await StockPrompt.findByPk(prompt_id);
    if (!prompt) return res.status(404).json({ code: 404, message: '提示词不存在' });

    // 构建用户消息：提示词正文 + 可选的要闻 + 可选的大盘数据 + 输出格式要求
    let userMsg = prompt.content || '';

    // 如果提示词配置了推送要闻，附加最近 5 条财经新闻标题
    if (prompt.push_news) {
      const newsList = await StockNews.findAll({
        order: [['pub_date', 'DESC']],
        limit: 10
      });
      if (newsList.length > 0) {
        userMsg += '\n\n【近期财经要闻】\n';
        newsList.slice(0, 5).forEach(n => {
          const dateStr = n.pub_date ? (typeof n.pub_date === 'string' ? n.pub_date.slice(0, 16) : new Date(n.pub_date).toISOString().slice(0, 16)) : '';
          userMsg += `- ${dateStr} ${n.title}\n`;
        });
      }
    }

    // 如果提示词配置了推送股市信息，附加三大指数当日行情
    if (prompt.push_stock_info) {
      try {
        const DataService = require('../services/DataService');
        const marketData = await DataService.getMarketOverview();
        if (marketData) {
          userMsg += '\n\n【今日大盘概况】\n';
          userMsg += `上证指数: ${marketData.shIndex?.price?.toFixed(2) || '-'} (${marketData.shIndex?.change_pct?.toFixed(2) || '-'}%)\n`;
          userMsg += `深证成指: ${marketData.szIndex?.price?.toFixed(2) || '-'} (${marketData.szIndex?.change_pct?.toFixed(2) || '-'}%)\n`;
          userMsg += `创业板指: ${marketData.cyIndex?.price?.toFixed(2) || '-'} (${marketData.cyIndex?.change_pct?.toFixed(2) || '-'}%)\n`;
        }
      } catch (e) {
        require('../utils/logger').error('获取大盘数据失败:', e.message);
      }
    }

    // 输出格式要求放在消息最后，确保模型按指定 JSON 格式输出
    if (prompt.output_format) {
      userMsg += '\n\n' + prompt.output_format;
    }

    const systemMsg = '你是一位专业的A股投资分析师，请根据用户要求和市场信息推荐股票。';

    // 读取 web search 开关配置
    const webSearchEnabled = cfg.web_search_enabled === '1';

    // 国内 API 直接禁用代理，避免走系统代理导致请求失败
    const axiosConfig = {
      headers: { Authorization: `Bearer ${api_key}`, 'Content-Type': 'application/json' },
      timeout: 60000,
      proxy: false
    };

    // 构建请求体，根据 provider 注入不同的 web search 参数
    const requestBody = buildLlmRequest({ provider, model_name, systemMsg, userMsg, webSearchEnabled });

    const llmRes = await axios.post(api_url, requestBody, axiosConfig);

    const rawContent = llmRes.data?.choices?.[0]?.message?.content || '';

    // 解析模型返回的 JSON，兼容 markdown 代码块包裹（```json ... ```）
    let parsed = { stocks: [], analysis: '' };
    try {
      const jsonStr = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (_) {
      // 解析失败时 stocks 为空，前端展示原始内容供用户参考
    }

    res.json({
      code: 0,
      data: {
        raw_response:       rawContent,
        stocks:             parsed.stocks || [],
        analysis:           parsed.analysis || '',
        prompt_id:          prompt.id,
        prompt_name:        prompt.name,
        llm_model:          model_name,
        observation_period: observation_period || '一月'
      }
    });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    res.status(500).json({ code: 500, message: msg });
  }
};

// 确认选股：将用户勾选的股票批量保存到 stock_predictions 表
// 若该股票已有记录则更新（重置为 active），否则新建
exports.confirm = async (req, res) => {
  try {
    const { stocks, prompt_id, prompt_name, llm_model, llm_response, observation_period } = req.body;
    if (!Array.isArray(stocks) || stocks.length === 0) {
      return res.json({ code: 1, message: '请至少选择一只股票' });
    }

    const now = new Date();
    const results = [];

    for (const s of stocks) {
      const existing = await StockPrediction.findOne({ where: { stock_code: s.code } });

      if (existing) {
        // 已有记录：更新所有字段，状态重置为进行中
        await existing.update({
          stockup_date:       now,
          stock_name:         s.name,
          reason:             s.reason || existing.reason,
          llm_model,
          prompt_id,
          prompt_name:        prompt_name || existing.prompt_name,
          llm_response:       llm_response || existing.llm_response,
          observation_period: observation_period || existing.observation_period,
          status:             'active'
        });
        results.push(existing);
      } else {
        // 新股票：创建记录
        const record = await StockPrediction.create({
          stock_code:         s.code,
          stock_name:         s.name,
          stockup_date:       now,
          reason:             s.reason || '',
          status:             'active',
          llm_model,
          prompt_id,
          prompt_name,
          llm_response,
          observation_period: observation_period || '一月'
        });
        results.push(record);
      }
    }

    res.json({ code: 0, data: results });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 删除单条选股记录
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await StockPrediction.destroy({ where: { id } });
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 批量恢复：将指定记录状态改回 active，选股时间重置为当前时间
exports.restore = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ code: 1, message: '请选择要恢复的记录' });
    }
    const now = new Date();
    await StockPrediction.update(
      { status: 'active', stockup_date: now },
      { where: { id: ids } }
    );
    res.json({ code: 0, message: `已恢复 ${ids.length} 条` });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 批量删除选股记录
exports.batchDelete = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ code: 1, message: '请选择要删除的记录' });
    }
    await StockPrediction.destroy({ where: { id: ids } });
    res.json({ code: 0, message: `已删除 ${ids.length} 条` });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};
