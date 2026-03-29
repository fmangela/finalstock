// 前端 HTTP 请求封装
// 基于 axios 创建统一实例，所有接口调用均通过此模块
// 响应拦截器自动解包 res.data，调用方直接拿到后端返回的 JSON 对象
import axios from 'axios'

const http = axios.create({
  baseURL: '/finalstock/api', // 与 vite.config.js 中的代理路径对应
  timeout: 10000              // 默认超时 10 秒，耗时接口可单独覆盖
})

// 响应拦截：成功时直接返回 data，失败时透传 error 供调用方处理
http.interceptors.response.use(
  res => res.data,
  err => Promise.reject(err)
)

// ── 股票行情 API ──────────────────────────────────────────────
export const stockApi = {
  getList:         (params) => http.get('/stocks/list', { params }),          // 股票列表（分页+搜索）
  getQuote:        (code) => http.get(`/stocks/${code}/quote`),               // 实时行情
  getHistory:      (code, params) => http.get(`/stocks/${code}/history`, { params }), // 历史 K 线
  getMarketOverview: () => http.get('/stocks/market/overview')                // 大盘三大指数
}

// ── 财经新闻 API ──────────────────────────────────────────────
export const newsApi = {
  getList: (params) => http.get('/news/list', { params }),
  refresh: () => http.post('/news/refresh')  // 手动触发同步
}

// ── AI 选股 API ───────────────────────────────────────────────
export const predictionApi = {
  getList:      (params) => http.get('/prediction/list', { params }),
  generate:     (data) => http.post('/prediction/generate', data),
  execute:      (data) => http.post('/prediction/execute', data, { timeout: 90000 }), // LLM 调用超时 90s
  confirm:      (data) => http.post('/prediction/confirm', data),
  abandon:      (id) => http.post(`/prediction/${id}/abandon`),
  updateStatus: (id, data) => http.put(`/prediction/${id}/status`, data),
  delete:       (id) => http.delete(`/prediction/${id}`),
  restore:      (ids) => http.post('/prediction/restore', { ids }),
  batchDelete:  (ids) => http.post('/prediction/batch-delete', { ids })
}

// ── 提示词模板 API ────────────────────────────────────────────
export const promptApi = {
  getList: () => http.get('/prompts/list'),
  create:  (data) => http.post('/prompts', data),
  update:  (id, data) => http.put(`/prompts/${id}`, data),
  remove:  (id) => http.delete(`/prompts/${id}`)
}

// ── 大模型配置 API ────────────────────────────────────────────
export const llmConfigApi = {
  get:  () => http.get('/llm-config/get'),
  save: (data) => http.post('/llm-config/save', data),
  test: (data) => http.post('/llm-config/test', data)  // 连接测试
}

// ── 模拟交易 API ──────────────────────────────────────────────
export const simulationApi = {
  getAccount:   () => http.get('/simulation/account'),
  getPositions: (params) => http.get('/simulation/positions', { params }),
  buy:          (data) => http.post('/simulation/buy', data),
  sell:         (data) => http.post('/simulation/sell', data)
}

// ── 每日市场指导 API ──────────────────────────────────────────
export const analysisApi = {
  getToday: () => http.get('/analysis/guidance/today'),
  save:     (data) => http.post('/analysis/guidance/save', data)
}

// ── 系统配置 API ──────────────────────────────────────────────
export const configApi = {
  getAll:          () => http.get('/config/all'),
  save:            (data) => http.post('/config/save', data),
  reloadSync:      () => http.post('/config/reload-sync'),
  schedulerStatus: () => http.get('/config/scheduler/status')
}

// ── 应用日志 API ──────────────────────────────────────────────
export const logApi = {
  getConfig:  () => http.get('/logs/config'),
  saveConfig: (data) => http.post('/logs/config', data),
  getList:    (params) => http.get('/logs/list', { params }),
  clear:      () => http.delete('/logs/clear')
}

// ── 策略回测 API ──────────────────────────────────────────────
export const backtestApi = {
  getStocks:    () => http.get('/backtest/stocks'),
  getConfigs:   () => http.get('/backtest/configs'),
  createConfig: (data) => http.post('/backtest/configs', data),
  updateConfig: (id, data) => http.put(`/backtest/configs/${id}`, data),
  deleteConfig: (id) => http.delete(`/backtest/configs/${id}`),
  getResults:   (params) => http.get('/backtest/results', { params }),
  getResult:    (id) => http.get(`/backtest/results/${id}`),
  deleteResult: (id) => http.delete(`/backtest/results/${id}`),
  run:          (data) => http.post('/backtest/run', data, { timeout: 60000 }) // 回测超时 60s
}

// ── 模拟交易（新）API ─────────────────────────────────────────
export const simApi = {
  getTasks:   ()       => http.get('/sim/tasks'),
  createTask: (data)   => http.post('/sim/tasks', data),
  updateTask: (id, data) => http.put(`/sim/tasks/${id}`, data),
  deleteTask: (id)     => http.delete(`/sim/tasks/${id}`),
  getTask:    (id)     => http.get(`/sim/tasks/${id}`),
  runTask:    (id)     => http.post(`/sim/tasks/${id}/run`),
  getStocks:  ()       => http.get('/sim/stocks')
}

// ── 自动流程 API ──────────────────────────────────────────────
export const workflowApi = {
  getConfig:      () => http.get('/workflow/config'),
  saveConfig:     (data) => http.post('/workflow/config', data),
  getPrompts:     () => http.get('/workflow/prompts'),
  getStrategies:  () => http.get('/workflow/strategies'),
  runPickStock:   () => http.post('/workflow/run/pick-stock', {}, { timeout: 120000 }),
  runBacktest:    () => http.post('/workflow/run/backtest', {}, { timeout: 15000 }),
  getBacktestTask:(taskId) => http.get(`/workflow/run/backtest/task/${taskId}`),
  runSimulation:  () => http.post('/workflow/run/simulation', {}),
  reloadSchedule: () => http.post('/workflow/reload-schedule', {}),
  getCalendar:    (year, month) => http.get('/workflow/calendar', { params: { year, month } })
}

// ── 策略管理 API ──────────────────────────────────────────────
export const strategyApi = {
  getStrategies:    () => http.get('/strategy/strategies'),
  getStrategyDetail:(id) => http.get(`/strategy/strategies/${id}`),
  createStrategy:   (data) => http.post('/strategy/strategies', data),
  updateStrategy:   (id, data) => http.put(`/strategy/strategies/${id}`, data),
  deleteStrategy:   (id) => http.delete(`/strategy/strategies/${id}`),
  addParam:         (data) => http.post('/strategy/params', data),
  getInstances:     (params) => http.get('/strategy/instances', { params }),
  createInstance:   (data) => http.post('/strategy/instances', data),
  updateInstance:   (id, data) => http.put(`/strategy/instances/${id}`, data),
  deleteInstance:   (id) => http.delete(`/strategy/instances/${id}`)
}
