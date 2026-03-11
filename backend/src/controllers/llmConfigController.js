const axios = require('axios');
const { SystemConfig } = require('../models');

const CONFIG_GROUP = 'llm_config';

exports.get = async (req, res) => {
  try {
    const configs = await SystemConfig.findAll({ where: { config_group: CONFIG_GROUP } });
    const data = {};
    configs.forEach(c => { data[c.config_key] = c.config_value; });
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

exports.save = async (req, res) => {
  try {
    const { api_url, api_key, model_name } = req.body;
    const entries = { api_url, api_key, model_name };
    for (const [key, value] of Object.entries(entries)) {
      await SystemConfig.upsert({
        config_group: CONFIG_GROUP,
        config_key: key,
        config_value: value ?? ''
      });
    }
    res.json({ code: 0, message: '保存成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

exports.test = async (req, res) => {
  try {
    const configs = await SystemConfig.findAll({ where: { config_group: CONFIG_GROUP } });
    const cfg = {};
    configs.forEach(c => { cfg[c.config_key] = c.config_value; });

    const { api_url, api_key, model_name } = cfg;
    if (!api_url || !api_key || !model_name) {
      return res.json({ code: 1, message: '请先完整配置大模型参数' });
    }

    const response = await axios.post(api_url, {
      model: model_name,
      messages: [{ role: 'user', content: '你好，请回复"连接成功"' }],
      max_tokens: 20
    }, {
      headers: { Authorization: `Bearer ${api_key}`, 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const reply = response.data?.choices?.[0]?.message?.content || '无回复';
    res.json({ code: 0, message: `连接成功: ${reply}` });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    res.json({ code: 1, message: `连接失败: ${msg}` });
  }
};
