import axios from 'axios'

const http = axios.create({
  baseURL: '/finalstock/api',
  timeout: 10000
})

http.interceptors.response.use(
  res => res.data,
  err => Promise.reject(err)
)

export const stockApi = {
  getList: (params) => http.get('/stocks/list', { params }),
  getQuote: (code) => http.get(`/stocks/${code}/quote`),
  getHistory: (code, params) => http.get(`/stocks/${code}/history`, { params }),
  getMarketOverview: () => http.get('/stocks/market/overview')
}

export const newsApi = {
  getList: (params) => http.get('/news/list', { params }),
  refresh: () => http.post('/news/refresh')
}

export const predictionApi = {
  getList: (params) => http.get('/prediction/list', { params }),
  generate: (data) => http.post('/prediction/generate', data),
  execute: (data) => http.post('/prediction/execute', data, { timeout: 90000 }),
  confirm: (data) => http.post('/prediction/confirm', data),
  abandon: (id) => http.post(`/prediction/${id}/abandon`),
  updateStatus: (id, data) => http.put(`/prediction/${id}/status`, data),
  delete: (id) => http.delete(`/prediction/${id}`),
  restore: (ids) => http.post('/prediction/restore', { ids }),
  batchDelete: (ids) => http.post('/prediction/batch-delete', { ids })
}

export const promptApi = {
  getList: () => http.get('/prompts/list'),
  create: (data) => http.post('/prompts', data),
  update: (id, data) => http.put(`/prompts/${id}`, data),
  remove: (id) => http.delete(`/prompts/${id}`)
}

export const llmConfigApi = {
  get: () => http.get('/llm-config/get'),
  save: (data) => http.post('/llm-config/save', data),
  test: () => http.post('/llm-config/test')
}

export const simulationApi = {
  getAccount: () => http.get('/simulation/account'),
  getPositions: (params) => http.get('/simulation/positions', { params }),
  buy: (data) => http.post('/simulation/buy', data),
  sell: (data) => http.post('/simulation/sell', data)
}

export const analysisApi = {
  getToday: () => http.get('/analysis/guidance/today'),
  save: (data) => http.post('/analysis/guidance/save', data)
}

export const configApi = {
  getAll: () => http.get('/config/all'),
  save: (data) => http.post('/config/save', data),
  reloadSync: () => http.post('/config/reload-sync')
}

export const logApi = {
  getConfig: () => http.get('/logs/config'),
  saveConfig: (data) => http.post('/logs/config', data),
  getList: (params) => http.get('/logs/list', { params }),
  clear: () => http.delete('/logs/clear')
}

export const backtestApi = {
  getStocks: () => http.get('/backtest/stocks'),
  getConfigs: () => http.get('/backtest/configs'),
  createConfig: (data) => http.post('/backtest/configs', data),
  updateConfig: (id, data) => http.put(`/backtest/configs/${id}`, data),
  deleteConfig: (id) => http.delete(`/backtest/configs/${id}`),
  getResults: (params) => http.get('/backtest/results', { params }),
  getResult: (id) => http.get(`/backtest/results/${id}`),
  deleteResult: (id) => http.delete(`/backtest/results/${id}`),
  run: (data) => http.post('/backtest/run', data, { timeout: 60000 })
}

export const strategyApi = {
  getStrategies: () => http.get('/strategy/strategies'),
  getStrategyDetail: (id) => http.get(`/strategy/strategies/${id}`),
  createStrategy: (data) => http.post('/strategy/strategies', data),
  updateStrategy: (id, data) => http.put(`/strategy/strategies/${id}`, data),
  deleteStrategy: (id) => http.delete(`/strategy/strategies/${id}`),
  addParam: (data) => http.post('/strategy/params', data),
  getInstances: (params) => http.get('/strategy/instances', { params }),
  createInstance: (data) => http.post('/strategy/instances', data),
  updateInstance: (id, data) => http.put(`/strategy/instances/${id}`, data),
  deleteInstance: (id) => http.delete(`/strategy/instances/${id}`)
}
