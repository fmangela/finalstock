// 大模型配置路由
// 支持国内主流 LLM 提供商（硅基流动、通义千问、文心一言等）及自定义接口
// 所有配置持久化到 system_configs 表（config_group='llm_config'）
const router = require('express').Router();
const { SystemConfig } = require('../models');
const axios = require('axios');

function maskSecret(value) {
  if (!value) return '';
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 3)}${'*'.repeat(Math.max(4, value.length - 7))}${value.slice(-4)}`;
}

async function loadSavedConfig() {
  const configs = await SystemConfig.findAll({ where: { config_group: 'llm_config' } });
  const cfg = {};
  configs.forEach(c => { cfg[c.config_key] = c.config_value; });
  return cfg;
}

// 内置提供商列表：前端下拉选择后自动填充 baseUrl 和可用模型
// web_search_support: 是否支持联网搜索
// web_search_models: 支持联网搜索的模型列表（为空表示全部支持）
const LLM_PROVIDERS = {
  'siliconflow': {
    name: '硅基流动 (SiliconFlow)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: 'Qwen/Qwen2.5-7B-Instruct,Qwen/Qwen2.5-14B-Instruct,Qwen/Qwen2.5-72B-Instruct,Qwen/Qwen2.5-72B-Instruct-128K,deepseek-ai/DeepSeek-V3,deepseek-ai/DeepSeek-R1,THUDM/glm-4-9b-chat,meta-llama/Meta-Llama-3.1-70B-Instruct',
    web_search_support: false,
    web_search_note: '不支持内置联网搜索，需自行实现搜索工具'
  },
  'qwen': {
    name: '阿里通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: 'qwen-turbo,qwen-plus,qwen-max,qwen-long,qwen3-235b-a22b,qwen3-32b,qwen3-14b,qwen3-8b',
    web_search_support: true,
    web_search_note: '通过 enable_search:true 参数启用，支持 qwen-turbo/plus/max 等主流模型'
  },
  'ernie': {
    name: '百度文心一言',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    models: 'ernie-4.0-8k,ernie-4.0-turbo-8k,ernie-3.5-8k,ernie-3.5-128k,ernie-speed-8k,ernie-speed-128k',
    web_search_support: true,
    web_search_note: '默认开启联网搜索，可通过 disable_search:false 控制'
  },
  'glm': {
    name: '智谱GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: 'glm-4,glm-4-plus,glm-4-air,glm-4-flash,glm-4-long,glm-z1-flash',
    web_search_support: true,
    web_search_note: '通过 tools 数组传入 web_search 工具启用，支持 GLM-4 系列'
  },
  'hunyuan': {
    name: '腾讯混元',
    baseUrl: 'https://hunyuan.cloud.tencent.com/api/v3',
    models: 'hunyuan-turbos-latest,hunyuan-t1-latest,hunyuan-pro,hunyuan-standard,hunyuan-lite',
    web_search_support: true,
    web_search_note: '通过 enable_search:true 参数启用，hunyuan-lite 不支持'
  },
  'moonshot': {
    name: '月之暗面(Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: 'kimi-k2-0711-preview,moonshot-v1-8k,moonshot-v1-32k,moonshot-v1-128k',
    web_search_support: true,
    web_search_note: '仅 kimi-k2 系列支持内置联网搜索，通过 tools 传入 $web_search 工具'
  },
  'baichuan': {
    name: '百川智能',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    models: 'Baichuan4,Baichuan4-Air,Baichuan3-Turbo,Baichuan3-Turbo-128k,Baichuan2-Turbo',
    web_search_support: true,
    web_search_note: '通过 with_search_enhance:true 参数启用，注意会产生额外费用'
  },
  'sensetime': {
    name: '商汤日日新',
    baseUrl: 'https://api.sensetime.com/v1',
    models: 'SenseChat-5-Systems,SenseChat-5,SenseChat-3.5',
    web_search_support: false,
    web_search_note: '不支持内置联网搜索'
  },
  'deepseek': {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: 'deepseek-chat,deepseek-reasoner',
    web_search_support: false,
    web_search_note: '官方 API 不支持内置联网搜索，需自行实现搜索工具'
  },
  'custom': {
    name: '自定义',
    baseUrl: '',
    models: '',
    web_search_support: false,
    web_search_note: ''
  }
};

// 获取当前 LLM 配置，同时返回提供商列表（供前端下拉渲染）
router.get('/get', async (req, res) => {
  try {
    const configs = await loadSavedConfig();
    const result = { providers: LLM_PROVIDERS };
    for (const [key, value] of Object.entries(configs)) {
      result[key] = key === 'api_key' ? maskSecret(value) : value;
    }
    result.api_key_masked = Boolean(configs.api_key);
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 保存 LLM 配置（provider / api_url / api_key / model_name / web_search_enabled）
router.post('/save', async (req, res) => {
  try {
    const { provider, api_url, api_key, model_name, web_search_enabled, api_key_changed } = req.body;
    const saved = await loadSavedConfig();
    const nextApiKey = api_key_changed === true || api_key_changed === '1'
      ? (api_key || '')
      : (saved.api_key || '');
    const items = [
      { key: 'provider', value: provider },
      { key: 'api_url', value: api_url },
      { key: 'api_key', value: nextApiKey },
      { key: 'model_name', value: model_name },
      { key: 'web_search_enabled', value: (web_search_enabled === true || web_search_enabled === '1') ? '1' : '0' }
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
    const saved = await loadSavedConfig();
    const apiKeyChanged = req.body.api_key_changed === true || req.body.api_key_changed === '1';
    const provider = req.body.provider || saved.provider;
    const api_url = req.body.api_url || saved.api_url;
    const api_key = apiKeyChanged ? req.body.api_key : (req.body.api_key || saved.api_key);
    const model_name = req.body.model_name || saved.model_name;

    Object.assign(req.body, {
      provider,
      api_url,
      api_key,
      model_name
    });
    
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
