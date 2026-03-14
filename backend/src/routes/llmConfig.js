// 大模型配置路由
// 支持国内主流 LLM 提供商（硅基流动、通义千问、文心一言等）及自定义接口
// 所有配置持久化到 system_configs 表（config_group='llm_config'）
const router = require('express').Router();
const { SystemConfig } = require('../models');
const axios = require('axios');

// 内置提供商列表：前端下拉选择后自动填充 baseUrl 和可用模型
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

// 获取当前 LLM 配置，同时返回提供商列表（供前端下拉渲染）
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

// 保存 LLM 配置（provider / api_url / api_key / model_name）
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

// 测试 LLM 连接：发送一条简单消息，验证 API Key 和地址是否可用
// 可传入临时参数测试，也可不传参数（自动读取已保存配置）
router.post('/test', async (req, res) => {
  try {
    const { provider, api_url, api_key, model_name } = req.body;

    // 未传参数时，从数据库读取已保存的配置
    if (!provider && !api_url) {
      const configs = await SystemConfig.findAll({ where: { config_group: 'llm_config' } });
      const cfg = {};
      configs.forEach(c => { cfg[c.config_key] = c.config_value; });
      Object.assign(req.body, cfg);
    }
    
    // 从 URL 推断 provider
    let p = req.body.provider || 'custom';
    if (!p || p === 'custom') {
      if (req.body.api_url?.includes('siliconflow')) p = 'siliconflow';
      else if (req.body.api_url?.includes('qianfan')) p = 'ernie';
      else if (req.body.api_url?.includes('dashscope')) p = 'qwen';
      else if (req.body.api_url?.includes('bigmodel')) p = 'glm';
      else if (req.body.api_url?.includes('hunyuan')) p = 'hunyuan';
      else if (req.body.api_url?.includes('moonshot')) p = 'moonshot';
      else if (req.body.api_url?.includes('baichuan')) p = 'baichuan';
    }
    
    const url = req.body.api_url;
    const key = req.body.api_key;
    const model = req.body.model_name;
    
    if (!key || !model) {
      return res.status(400).json({ code: 400, message: '请填写API Key和模型名称' });
    }
    if (!url) {
      return res.status(400).json({ code: 400, message: '请填写API地址' });
    }

    // 构建请求
    const fullUrl = p !== 'custom' && LLM_PROVIDERS[p] 
      ? `${LLM_PROVIDERS[p].baseUrl}/chat/completions` 
      : url;
    
    const headers = { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
    const data = { model: model, messages: [{ role: 'user', content: '你好' }], max_tokens: 50 };
    
    // 国内 API 默认禁用代理（proxy: false），避免走系统代理导致连接失败
    const axiosConfig = { headers, timeout: 15000, proxy: false };

    // 非国内主流 API（如 OpenAI）且系统配置了代理时，启用代理
    const isChineseAPI = fullUrl.includes('siliconflow') || fullUrl.includes('qianfan') || fullUrl.includes('dashscope') || fullUrl.includes('bigmodel') || fullUrl.includes('hunyuan') || fullUrl.includes('moonshot') || fullUrl.includes('baichuan');
    
    if (!isChineseAPI && (process.env.HTTP_PROXY || process.env.HTTPS_PROXY)) {
      const { URL } = require('url');
      const proxyUrl = new URL(process.env.HTTP_PROXY || process.env.HTTPS_PROXY);
      axiosConfig.proxy = { host: proxyUrl.hostname, port: parseInt(proxyUrl.port), protocol: proxyUrl.protocol.replace(':', '') };
    }
    
    const response = await axios.post(fullUrl, data, axiosConfig);
    
    if (response.data?.choices?.length > 0) {
      res.json({ code: 0, message: '连接成功', data: response.data.choices[0].message.content });
    } else {
      res.json({ code: 0, message: '连接成功，但无返回内容', data: response.data });
    }
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.response?.data?.message || e.message;
    const debugInfo = { status: e.response?.status, error: e.message };
    res.status(500).json({ code: 500, message: msg + ' ' + JSON.stringify(debugInfo) });
  }
});

module.exports = router;