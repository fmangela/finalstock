const axios = require('axios');
const { StockPrediction, StockPrompt, StockNews, SystemConfig } = require('../models');

exports.getList = async (req, res) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const where = status ? { status } : {};
    const { count, rows } = await StockPrediction.findAndCountAll({
      where,
      order: [['stockup_date', 'DESC']],
      limit: +pageSize,
      offset: (+page - 1) * +pageSize
    });
    res.json({ code: 0, data: { total: count, list: rows } });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

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

// 执行AI选股：调用大模型，返回匹配股票列表（不保存）
exports.execute = async (req, res) => {
  try {
    const { prompt_id, observation_period } = req.body;

    // 读取大模型配置
    const configs = await SystemConfig.findAll({ where: { config_group: 'llm_config' } });
    const cfg = {};
    configs.forEach(c => { cfg[c.config_key] = c.config_value; });
    const { provider, api_url, api_key, model_name } = cfg;
    if (!api_key || !model_name) {
      return res.json({ code: 1, message: '请先在设置中配置大模型参数' });
    }

    // 读取提示词
    const prompt = await StockPrompt.findByPk(prompt_id);
    if (!prompt) return res.status(404).json({ code: 404, message: '提示词不存在' });

    // 构建用户消息，可能包含要闻和股市信息
    let userMsg = prompt.content;
    
    // 如果提示词配置了推送要闻，获取最新的财经要闻
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
    
    // 如果提示词配置了推送股市信息，获取大盘概览
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
        console.error('获取大盘数据失败:', e.message);
      }
    }

    // 构建消息
    const systemMsg = '你是一位专业的A股投资分析师，请根据用户要求和市场信息推荐股票，必须以JSON格式返回。';

    // 代理配置 - 国内API直接禁用代理
    const axiosConfig = {
      headers: { Authorization: `Bearer ${api_key}`, 'Content-Type': 'application/json' },
      timeout: 60000,
      proxy: false
    };

    const llmRes = await axios.post(api_url, {
      model: model_name,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.7
    }, axiosConfig);

    const rawContent = llmRes.data?.choices?.[0]?.message?.content || '';

    // 解析JSON，兼容markdown代码块包裹
    let parsed = { stocks: [], analysis: '' };
    try {
      const jsonStr = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (_) {
      // 解析失败时返回原始内容，stocks为空
    }

    res.json({
      code: 0,
      data: {
        raw_response: rawContent,
        stocks: parsed.stocks || [],
        analysis: parsed.analysis || '',
        prompt_id: prompt.id,
        prompt_name: prompt.name,
        llm_model: model_name,
        observation_period: observation_period || '一月'
      }
    });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    res.status(500).json({ code: 500, message: msg });
  }
};

// 确认选股：将用户勾选的股票批量保存到 stock_predictions
exports.confirm = async (req, res) => {
  try {
    const { stocks, prompt_id, prompt_name, llm_model, llm_response, observation_period } = req.body;
    if (!Array.isArray(stocks) || stocks.length === 0) {
      return res.json({ code: 1, message: '请至少选择一只股票' });
    }

    const now = new Date();
    const results = [];
    
    for (const s of stocks) {
      // 不管之前状态是什么，都更新为最新选股记录
      const existing = await StockPrediction.findOne({ 
        where: { stock_code: s.code }
      });
      
      if (existing) {
        // 更新所有信息，状态改为进行中(active)
        await existing.update({
          stockup_date: now,
          stock_name: s.name,
          reason: s.reason || existing.reason,
          llm_model,
          prompt_id,
          prompt_name: prompt_name || existing.prompt_name,
          llm_response: llm_response || existing.llm_response,
          observation_period: observation_period || existing.observation_period,
          status: 'active'  // 无论之前状态是什么，都改为进行中
        });
        results.push(existing);
      } else {
        // 新增记录
        const record = await StockPrediction.create({
          stock_code: s.code,
          stock_name: s.name,
          stockup_date: now,
          reason: s.reason || '',
          status: 'active',
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

// 删除单条
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await StockPrediction.destroy({ where: { id } });
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 恢复（批量）- 状态改为active，选股时间改为当前
exports.restore = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ code: 1, message: '请选择要恢复的记录' });
    }
    const now = new Date();
    await StockPrediction.update({
      status: 'active',
      stockup_date: now
    }, { where: { id: ids } });
    res.json({ code: 0, message: `已恢复 ${ids.length} 条` });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 批量删除
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
