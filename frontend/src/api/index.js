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
  updateStatus: (id, data) => http.put(`/prediction/${id}/status`, data)
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
