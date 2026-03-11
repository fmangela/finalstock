const router = require('express').Router();
const { SystemConfig } = require('../models');
const axios = require('axios');

// LLM 提供商配置
const LLM_PROVIDERS = {
  'siliconflow': {
    name: '硅基流动 (SiliconFlow)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: 'Qwen/Qwen2.5-7B-Instruct,Qwen/Qwen2.5-14B-Instruct,Qwen/Qwen2.5-72B-Instruct,THUDG/glm-4-9b-chat,THUDG/glm-4-32k-chat,deepseek-ai/DeepSeek-V2-Chat,deepseek-ai/DeepSeek-Coder-V2-Instruct,meta-llama/Meta-Llama-3.1-70B-Instruct,meta-llama/Meta-Llama-3.1-8B-Instruct'
  },
  'qwen': {
    name: '阿里通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelKey: 'qwen-turbo,qwen-plus,qwen-max,qwen-max-longcontext'
  },
  'ernie': {
    name: '百度文心一言',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    modelKey: 'ernie-4.0-8k,ernie-3.5-8k,ernie-speed-8k'
  },
  'glm': {
    name: '智谱GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelKey: 'glm-4,glm-4-flash,glm-4-plus,glm-3-turbo'
  },
  'hunyuan': {
    name: '腾讯混元',
    baseUrl: 'https://hunyuan.cloud.tencent.com/api/v3',
    modelKey: 'hunyuan-pro,hunyuan-standard'
  },
  'moonshot': {
    name: '月之暗面(Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    modelKey: 'moonshot-v1-8k,moonshot-v1-32k,moonshot-v1-128k'
  },
  'baichuan': {
    name: '百川智能',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    modelKey: 'Baichuan4,Baichuan3-Turbo,Baichuan2-Turbo'
  },
  'sensetime': {
    name: '商汤日日新',
    baseUrl: 'https://api.sensetime.com/v1',
    modelKey: 'SenseChat-5-Systems,SenseChat-5,SenseChat-3.5'
  },
  'deepseek': {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelKey: 'deepseek-chat,deepseek-coder'
  },
  'custom': {
    name: '自定义',
    baseUrl: '',
    modelKey: ''
  }
};

// 获取 LLM 配置
router.get('/get', async (req, res) => {
  try {
    const configs = await SystemConfig.findAll({ where: { config_group: 'llm_config' } });
    const result = { providers: LLM_PROVIDERS };
    for (const c of configs) {
      result[c.config_key] = c.config_value;
    }
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 保存 LLM 配置
router.post('/save', async (req, res) => {
  try {
    const { provider, api_url, api_key, model_name } = req.body;
    const items = [
      { key: 'provider', value: provider },
      { key: 'api_url', value: api_url },
      { key: 'api_key', value: api_key },
      { key: 'model_name', value: model_name }
    ];
    for (const item of items) {
      await SystemConfig.findOrCreate({
        where: { config_group: 'llm_config', config_key: item.key },
        defaults: { config_value: item.value }
      }).then(([record]) => {
        if (!record.isNewRecord) record.update({ config_value: item.value });
      });
    }
    res.json({ code: 0, message: '保存成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 测试 LLM 连接
router.post('/test', async (req, res) => {
  try {
    const { provider, api_url, api_key, model_name } = req.body;
    
    let url, headers, data;
    
    if (provider === 'custom') {
      url = api_url;
      headers = { 'Authorization': `Bearer ${api_key}`, 'Content-Type': 'application/json' };
      data = { model: model_name, messages: [{ role: 'user', content: '你好' }], max_tokens: 50 };
    } else {
      const providerConfig = LLM_PROVIDERS[provider];
      if (!providerConfig) return res.status(400).json({ code: 400, message: '未知提供商' });
      url = `${providerConfig.baseUrl}/chat/completions`;
      headers = { 'Authorization': `Bearer ${api_key}`, 'Content-Type': 'application/json' };
      data = { model: model_name, messages: [{ role: 'user', content: '你好' }], max_tokens: 50 };
    }
    
    // 设置代理
    const proxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    const axiosConfig = { headers, timeout: 10000 };
    if (proxy) {
      const { URL } = require('url');
      const proxyUrl = new URL(proxy);
      axiosConfig.proxy = { host: proxyUrl.hostname, port: parseInt(proxyUrl.port), protocol: proxyUrl.protocol.replace(':', '') };
    }
    
    const response = await axios.post(url, data, axiosConfig);
    
    if (response.data?.choices?.length > 0) {
      res.json({ code: 0, message: '连接成功', data: response.data.choices[0].message.content });
    } else {
      res.json({ code: 0, message: '连接成功，但无返回内容' });
    }
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

module.exports = router;