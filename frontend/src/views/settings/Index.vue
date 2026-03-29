<template>
  <div>
    <el-card shadow="hover">
      <template #header><span>系统设置</span></template>
      <el-tabs v-model="activeTab">
        <!-- 数据源配置 -->
        <el-tab-pane label="数据源" name="data_source">
          <el-form :model="configs.data_source" label-width="120px" style="max-width:500px">
            <el-form-item label="数据提供商">
              <el-select v-model="configs.data_source.provider">
                <el-option label="AKShare (推荐)" value="akshare" />
                <el-option label="BaoStock" value="baostock" />
                <el-option label="Tushare" value="tushare" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveGroup('data_source')" :loading="saving">保存</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- LLM配置 -->
        <el-tab-pane label="LLM配置" name="llm_config">
          <el-form :model="llmForm" label-width="120px" style="max-width:600px">
            <el-form-item label="预设提供商">
              <el-select v-model="llmPreset" placeholder="选择预设提供商" clearable @change="applyPreset" style="width:100%">
                <el-option v-for="(p, key) in llmProviders" :key="key" :label="p.name" :value="key" />
              </el-select>
            </el-form-item>
            <el-form-item label="API地址">
              <el-input v-model="llmForm.api_url" placeholder="https://api.openai.com/v1/chat/completions" />
            </el-form-item>
            <el-form-item label="API Key">
              <el-input v-model="llmForm.api_key" type="password" show-password @input="onApiKeyInput" />
            </el-form-item>
            <el-form-item label="模型名称">
              <el-select
                v-if="currentProviderModels.length > 0"
                v-model="llmForm.model_name"
                placeholder="选择模型"
                allow-create
                filterable
                style="width:100%"
              >
                <el-option v-for="m in currentProviderModels" :key="m" :label="m" :value="m" />
              </el-select>
              <el-input v-else v-model="llmForm.model_name" placeholder="输入模型名称" />
            </el-form-item>
            <el-form-item label="联网搜索">
              <el-switch v-model="llmForm.web_search_enabled" :disabled="!currentProviderWebSearch" />
              <span style="margin-left:10px;font-size:12px;" :style="{ color: currentProviderWebSearch ? '#67c23a' : '#909399' }">
                {{ currentProviderWebSearchNote }}
              </span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveLlmConfig" :loading="saving">保存</el-button>
              <el-button @click="testLlmConfig" :loading="testing">测试连接</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 提示词管理 -->
        <el-tab-pane label="提示词管理" name="prompts">
          <div style="margin-bottom:12px">
            <el-button type="primary" @click="openPromptDialog()">新增提示词</el-button>
          </div>
          <el-table :data="prompts" v-loading="promptsLoading" stripe style="width:100%">
            <el-table-column prop="name" label="名称" width="160" />
            <el-table-column prop="market_type" label="股市" width="80" />
            <el-table-column prop="push_news" label="推送要闻" width="90">
              <template #default="{ row }"><el-tag :type="row.push_news ? 'success' : 'info'" size="small">{{ row.push_news ? '是' : '否' }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="push_stock_info" label="推送股市" width="90">
              <template #default="{ row }"><el-tag :type="row.push_stock_info ? 'success' : 'info'" size="small">{{ row.push_stock_info ? '是' : '否' }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="content" label="内容" min-width="150" show-overflow-tooltip />
            <el-table-column prop="output_format" label="返回格式" min-width="150">
              <template #default="{ row }">
                <span v-if="row.output_format" style="color:#67c23a">已配置</span>
                <span v-else style="color:#909399">默认</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button size="small" @click="openPromptDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="removePrompt(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 选股参数 -->
        <el-tab-pane label="选股参数" name="stock_filter">
          <el-form :model="configs.stock_filter" label-width="120px" style="max-width:500px">
            <el-form-item label="换手率最小值">
              <el-input-number v-model="configs.stock_filter.turnover_rate_min" :min="0" :max="100" />
              <span class="unit">%</span>
            </el-form-item>
            <el-form-item label="换手率最大值">
              <el-input-number v-model="configs.stock_filter.turnover_rate_max" :min="0" :max="100" />
              <span class="unit">%</span>
            </el-form-item>
            <el-form-item label="PE最小值">
              <el-input-number v-model="configs.stock_filter.pe_min" :min="0" />
            </el-form-item>
            <el-form-item label="PE最大值">
              <el-input-number v-model="configs.stock_filter.pe_max" :min="0" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveGroup('stock_filter')" :loading="saving">保存</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 日志配置 -->
        <el-tab-pane label="日志配置" name="logs">
          <el-form label-width="120px" style="max-width:500px">
            <el-form-item label="启用日志记录">
              <el-switch v-model="logEnabled" @change="saveLogEnabled" />
            </el-form-item>
            <el-form-item>
              <el-button type="danger" @click="clearLogs" :loading="logClearing">清空日志</el-button>
              <el-button @click="loadLogs" :loading="logsLoading">刷新</el-button>
            </el-form-item>
          </el-form>
          <el-table :data="logs" v-loading="logsLoading" stripe style="width:100%" size="small">
            <el-table-column prop="created_at" label="时间" width="170">
              <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
            </el-table-column>
            <el-table-column prop="level" label="级别" width="80">
              <template #default="{ row }">
                <el-tag :type="row.level === 'error' ? 'danger' : 'info'" size="small">{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="source" label="来源" width="100" />
            <el-table-column prop="message" label="消息" min-width="200" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>

        <!-- 调度器状态 -->
        <el-tab-pane label="调度器状态" name="scheduler">
          <div style="margin-bottom:12px;display:flex;align-items:center;gap:12px">
            <el-button @click="loadSchedulerStatus" :loading="schedulerLoading">刷新</el-button>
            <span v-if="schedulerStatus" style="color:#606266;font-size:13px">
              共 <b>{{ schedulerStatus.total }}</b> 个任务，
              已调度 <b style="color:#67c23a">{{ schedulerStatus.scheduled || 0 }}</b> 个，
              执行中 <b style="color:#e6a23c">{{ schedulerStatus.running || 0 }}</b> 个
            </span>
            <span v-if="schedulerStatus?.refreshedAt" style="color:#909399;font-size:12px">
              最近刷新：{{ new Date(schedulerStatus.refreshedAt).toLocaleTimeString() }}
            </span>
          </div>
          <el-table :data="schedulerStatus?.tasks || []" v-loading="schedulerLoading" stripe style="width:100%" size="small">
            <el-table-column prop="name" label="任务名称" width="200" />
            <el-table-column prop="cron" label="Cron 表达式" width="160">
              <template #default="{ row }">
                <el-tag type="info" size="small">{{ row.cron }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="80">
              <template #default="{ row }">
                <el-tag :type="row.type === 'fixed' ? 'primary' : 'warning'" size="small">
                  {{ row.type === 'fixed' ? '固定' : '动态' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="statusText" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="schedulerStatusTagType(row.status)" size="small">
                  {{ row.statusText }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="lastRunAt" label="最近执行" width="170">
              <template #default="{ row }">
                {{ row.lastRunAt ? new Date(row.lastRunAt).toLocaleString() : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="lastResult" label="最近结果" min-width="220" show-overflow-tooltip />
            <el-table-column prop="desc" label="说明" min-width="220" />
          </el-table>
        </el-tab-pane>

        <!-- 新闻源 -->
        <el-tab-pane label="新闻源" name="news">
          <el-form :model="configs.news" label-width="130px" style="max-width:600px">
            <el-form-item label="新闻来源">
              <el-checkbox-group v-model="newsSources">
                <el-checkbox value="eastmoney">东方财富</el-checkbox>
                <el-checkbox value="cls">财联社</el-checkbox>
                <el-checkbox value="cx">财新</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="新闻保留天数">
              <el-input-number v-model="configs.news.retention_days" :min="1" :max="365" />
              <span class="unit">天</span>
            </el-form-item>

            <el-divider content-position="left">同步周期配置</el-divider>

            <el-form-item label="启用定时同步">
              <el-switch v-model="syncConfig.enabled" />
            </el-form-item>
            <template v-if="syncConfig.enabled">
              <el-form-item label="周期类型">
                <el-select v-model="syncConfig.period_type" style="width:140px" @change="onPeriodTypeChange">
                  <el-option label="秒" value="second" />
                  <el-option label="分钟" value="minute" />
                  <el-option label="小时" value="hour" />
                  <el-option label="天" value="day" />
                  <el-option label="周" value="week" />
                  <el-option label="月" value="month" />
                  <el-option label="年" value="year" />
                </el-select>
              </el-form-item>
              <el-form-item label="周期数值">
                <el-input-number v-model="syncConfig.period_value" :min="periodValueMin" :max="periodValueMax" :step="1" />
                <span class="unit">{{ periodUnitLabel }}</span>
              </el-form-item>
              <el-form-item label="Cron 表达式">
                <el-tag type="info">{{ previewCron }}</el-tag>
              </el-form-item>
              <el-form-item label="起始时间">
                <el-date-picker v-model="syncConfig.start_time" type="datetime" placeholder="默认当前时间" format="YYYY-MM-DD HH:mm:ss" value-format="x" style="width:220px" />
              </el-form-item>
              <el-form-item label="终止时间">
                <el-checkbox v-model="syncConfig.no_end">无限</el-checkbox>
                <el-date-picker v-if="!syncConfig.no_end" v-model="syncConfig.end_time" type="datetime" placeholder="选择终止时间" format="YYYY-MM-DD HH:mm:ss" value-format="x" style="width:220px; margin-left:12px" />
              </el-form-item>
            </template>

            <el-form-item>
              <el-button type="primary" @click="saveNewsSettings" :loading="saving">保存</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 提示词编辑弹窗 -->
    <el-dialog v-model="promptDialogVisible" :title="promptForm.id ? '编辑提示词' : '新增提示词'" width="640px">
      <el-form :model="promptForm" label-width="100px">
        <el-form-item label="名称"><el-input v-model="promptForm.name" placeholder="提示词名称" /></el-form-item>
        <el-form-item label="匹配股市">
          <el-select v-model="promptForm.market_type">
            <el-option label="A股" value="A股" />
            <el-option label="港股" value="港股" />
            <el-option label="美股" value="美股" />
          </el-select>
        </el-form-item>
        <el-form-item label="推送要闻">
          <el-switch v-model="promptForm.push_news" />
          <span style="color:#999;margin-left:8px;font-size:12px">是否在请求时附加最新财经要闻</span>
        </el-form-item>
        <el-form-item label="推送股市信息">
          <el-switch v-model="promptForm.push_stock_info" />
          <span style="color:#999;margin-left:8px;font-size:12px">是否在请求时附加大盘行情数据</span>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="promptForm.content" type="textarea" :rows="5" placeholder="输入提示词主体内容，如分析要求、选股条件等" />
        </el-form-item>
        <el-form-item label="返回格式">
          <el-input v-model="promptForm.output_format" type="textarea" :rows="4" placeholder="请输入期望的返回格式要求" />
          <div style="color:#e6a23c;font-size:12px;margin-top:4px">
            <el-icon><Warning /></el-icon>
            此部分为JSON格式要求，修改可能导致解析失败，请谨慎修改
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="promptDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePrompt" :loading="promptSaving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { configApi, llmConfigApi, promptApi, logApi } from '@/api'

const activeTab = ref('data_source')
let schedulerTimer = null
const saving = ref(false)
const testing = ref(false)
const newsSources = ref([])
const configs = ref({
  data_source: { provider: 'akshare' },
  stock_filter: { turnover_rate_min: 2, turnover_rate_max: 20, pe_min: 5, pe_max: 50 },
  news: { sources: '[]', retention_days: 7 }
})

// LLM config
const llmForm = ref({ api_url: '', api_key: '', model_name: '', web_search_enabled: false })
const llmPreset = ref('')
const llmProviders = ref({})
const llmKeyMasked = ref(false)
const llmKeyDirty = ref(false)

// 从后端加载 providers 列表（含 web_search_support 等元数据）
const loadLlmProviders = async () => {
  try {
    const res = await llmConfigApi.get()
    if (res?.data?.providers) llmProviders.value = res.data.providers
  } catch (e) {
    console.warn('加载 LLM providers 失败:', e)
  }
}

const onApiKeyInput = () => {
  llmKeyDirty.value = true
  llmKeyMasked.value = false
}

// 当前选中 provider 的模型列表
const currentProviderModels = computed(() => {
  const p = llmProviders.value[llmPreset.value]
  if (!p?.models) return []
  return p.models.split(',').map(m => m.trim()).filter(Boolean)
})

// 当前 provider 是否支持联网搜索
const currentProviderWebSearch = computed(() => {
  return llmProviders.value[llmPreset.value]?.web_search_support ?? false
})

const currentProviderWebSearchNote = computed(() => {
  const p = llmProviders.value[llmPreset.value]
  if (!p) return '请先选择提供商'
  return p.web_search_note || (p.web_search_support ? '支持联网搜索' : '不支持联网搜索')
})

const applyPreset = (key) => {
  const p = llmProviders.value[key]
  if (!p) return
  llmForm.value.api_url = `${p.baseUrl}/chat/completions`
  // 切换 provider 时，若不支持联网则自动关闭开关
  if (!p.web_search_support) llmForm.value.web_search_enabled = false
}

const saveLlmConfig = async () => {
  saving.value = true
  try {
    await llmConfigApi.save({
      ...llmForm.value,
      provider: llmPreset.value,
      api_key_changed: llmKeyDirty.value
    })
    await loadConfigs()
    ElMessage.success('保存成功')
  } finally {
    saving.value = false
  }
}

const testLlmConfig = async () => {
  testing.value = true
  try {
    const res = await llmConfigApi.test({
      provider: llmPreset.value || 'custom',
      api_url: llmForm.value.api_url,
      ...(llmKeyDirty.value ? { api_key: llmForm.value.api_key } : {}),
      api_key_changed: llmKeyDirty.value,
      model_name: llmForm.value.model_name
    })
    if (res?.code === 0) ElMessage.success(res.message)
    else ElMessage.error(res?.message || '连接失败')
  } catch (e) {
    ElMessage.error('请求失败：' + (e.response?.data?.message || e.message))
  } finally {
    testing.value = false
  }
}

// Prompts
const prompts = ref([])
const promptsLoading = ref(false)
const promptDialogVisible = ref(false)
const promptSaving = ref(false)
// 默认返回格式要求
const defaultOutputFormat = `【返回格式要求】
请严格按照以下JSON格式返回，不要包含任何其他内容：
\`\`\`json
{
  "analysis": "简要分析说明（100字以内）",
  "stocks": [
    {"code": "股票代码", "name": "股票名称", "trend": "上涨/下跌/横盘", "reason": "推荐理由（50字以内）"}
  ]
}
\`\`\`
注意：stocks数组最多返回5只股票，必须以JSON格式返回。`;

const promptForm = ref({ id: null, name: '', content: '', market_type: 'A股', push_news: false, push_stock_info: false, output_format: defaultOutputFormat })

const loadPrompts = async () => {
  promptsLoading.value = true
  try {
    const res = await promptApi.getList()
    prompts.value = res?.data || []
  } finally {
    promptsLoading.value = false
  }
}

const openPromptDialog = (row = null) => {
  if (row) {
    promptForm.value = { 
      id: row.id, 
      name: row.name, 
      content: row.content, 
      market_type: row.market_type, 
      push_news: row.push_news, 
      push_stock_info: row.push_stock_info,
      output_format: row.output_format || defaultOutputFormat
    }
  } else {
    promptForm.value = { id: null, name: '', content: '', market_type: 'A股', push_news: false, push_stock_info: false, output_format: defaultOutputFormat }
  }
  promptDialogVisible.value = true
}

const savePrompt = async () => {
  promptSaving.value = true
  try {
    const { id, ...data } = promptForm.value
    if (id) await promptApi.update(id, data)
    else await promptApi.create(data)
    ElMessage.success('保存成功')
    promptDialogVisible.value = false
    loadPrompts()
  } finally {
    promptSaving.value = false
  }
}

const removePrompt = async (row) => {
  await ElMessageBox.confirm(`确认删除提示词「${row.name}」？`, '提示', { type: 'warning' })
  await promptApi.remove(row.id)
  ElMessage.success('删除成功')
  loadPrompts()
}

// Sync config
const syncConfig = ref({ enabled: false, period_type: 'hour', period_value: 6, start_time: Date.now(), end_time: null, no_end: true })

const periodMeta = {
  second: { label: '秒', min: 1, max: 59 },
  minute: { label: '分钟', min: 1, max: 59 },
  hour:   { label: '小时', min: 1, max: 23 },
  day:    { label: '天', min: 1, max: 31 },
  week:   { label: '周', min: 1, max: 52 },
  month:  { label: '月', min: 1, max: 12 },
  year:   { label: '年', min: 1, max: 10 }
}

const periodUnitLabel = computed(() => periodMeta[syncConfig.value.period_type]?.label || '')
const periodValueMin = computed(() => periodMeta[syncConfig.value.period_type]?.min || 1)
const periodValueMax = computed(() => periodMeta[syncConfig.value.period_type]?.max || 99)

function onPeriodTypeChange() {
  syncConfig.value.period_value = periodMeta[syncConfig.value.period_type]?.min || 1
}

const previewCron = computed(() => buildCronExpr(syncConfig.value.period_type, syncConfig.value.period_value))

function buildCronExpr(type, value) {
  const v = parseInt(value) || 1
  switch (type) {
    case 'second': return `*/${v} * * * * *`
    case 'minute': return `*/${v} * * * *`
    case 'hour':   return `0 */${v} * * *`
    case 'day':    return `0 0 */${v} * *`
    case 'week':   return `0 0 * * ${(v - 1) % 7}`
    case 'month':  return `0 0 1 */${v} *`
    case 'year':   return `0 0 1 1 *`
    default:       return `0 */6 * * *`
  }
}

const loadConfigs = async () => {
  const [configRes, llmRes] = await Promise.all([configApi.getAll(), llmConfigApi.get()])
  if (configRes?.data) {
    const d = configRes.data
    if (d.data_source) configs.value.data_source = { ...configs.value.data_source, ...d.data_source }
    if (d.stock_filter) {
      configs.value.stock_filter = {
        turnover_rate_min: +d.stock_filter.turnover_rate_min || 2,
        turnover_rate_max: +d.stock_filter.turnover_rate_max || 20,
        pe_min: +d.stock_filter.pe_min || 5,
        pe_max: +d.stock_filter.pe_max || 50
      }
    }
      if (d.news) {
        if (d.news.sources) {
          try {
            newsSources.value = JSON.parse(d.news.sources)
          } catch (e) {
            console.warn('解析新闻源配置失败:', e)
            newsSources.value = []
          }
        }
      if (d.news.retention_days) configs.value.news.retention_days = +d.news.retention_days || 7
      syncConfig.value.enabled = d.news.sync_enabled === '1'
      if (d.news.sync_period_type) syncConfig.value.period_type = d.news.sync_period_type
      if (d.news.sync_period_value) syncConfig.value.period_value = +d.news.sync_period_value || 6
      const startTs = parseInt(d.news.sync_start_time) || 0
      syncConfig.value.start_time = startTs > 0 ? startTs : Date.now()
      const endTs = parseInt(d.news.sync_end_time) || 0
      syncConfig.value.no_end = endTs === 0
      syncConfig.value.end_time = endTs > 0 ? endTs : null
    }
    if (d.logging) logEnabled.value = d.logging.enabled === '1'
  }
  if (llmRes?.data) {
    llmForm.value = {
      api_url: llmRes.data.api_url || '',
      api_key: llmRes.data.api_key || '',
      model_name: llmRes.data.model_name || '',
      web_search_enabled: llmRes.data.web_search_enabled === '1'
    }
    llmKeyMasked.value = Boolean(llmRes.data.api_key_masked && llmRes.data.api_key)
    llmKeyDirty.value = false
    if (llmRes.data.provider) llmPreset.value = llmRes.data.provider
  }
}

const saveGroup = async (group) => {
  saving.value = true
  try {
    const groupData = configs.value[group]
    await Promise.all(Object.entries(groupData).map(([key, value]) =>
      configApi.save({ config_group: group, config_key: key, config_value: String(value) })
    ))
    ElMessage.success('保存成功')
  } finally {
    saving.value = false
  }
}

const saveNewsSettings = async () => {
  saving.value = true
  try {
    const cronExpr = buildCronExpr(syncConfig.value.period_type, syncConfig.value.period_value)
    const startTs = syncConfig.value.start_time ? String(syncConfig.value.start_time) : String(Date.now())
    const endTs = syncConfig.value.no_end ? '0' : String(syncConfig.value.end_time || 0)
    await Promise.all([
      configApi.save({ config_group: 'news', config_key: 'sources', config_value: JSON.stringify(newsSources.value) }),
      configApi.save({ config_group: 'news', config_key: 'retention_days', config_value: String(configs.value.news.retention_days) }),
      configApi.save({ config_group: 'news', config_key: 'sync_enabled', config_value: syncConfig.value.enabled ? '1' : '0' }),
      configApi.save({ config_group: 'news', config_key: 'sync_period_type', config_value: syncConfig.value.period_type }),
      configApi.save({ config_group: 'news', config_key: 'sync_period_value', config_value: String(syncConfig.value.period_value) }),
      configApi.save({ config_group: 'news', config_key: 'sync_start_time', config_value: startTs }),
      configApi.save({ config_group: 'news', config_key: 'sync_end_time', config_value: endTs }),
      configApi.save({ config_group: 'news', config_key: 'sync_cron_expr', config_value: cronExpr })
    ])
    await configApi.reloadSync()
    ElMessage.success('保存成功，调度已更新')
  } catch (e) {
    ElMessage.error('保存失败：' + (e.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

// Logs
const logs = ref([])
const logsLoading = ref(false)
const logClearing = ref(false)
const logEnabled = ref(false)

const schedulerStatusTagType = (status) => ({
  running: 'warning',
  scheduled: 'success',
  disabled: 'info',
  stopped: 'danger',
  idle: 'info'
}[status] || 'info')

const loadLogs = async () => {
  logsLoading.value = true
  try {
    const res = await logApi.getList()
    logs.value = res?.data?.list || []
  } finally {
    logsLoading.value = false
  }
}

const clearLogs = async () => {
  await ElMessageBox.confirm('确认清空所有日志？', '提示', { type: 'warning' })
  logClearing.value = true
  try {
    await logApi.clear()
    logs.value = []
    ElMessage.success('日志已清空')
  } finally {
    logClearing.value = false
  }
}

const saveLogEnabled = async (val) => {
  await logApi.saveConfig({ enabled: val })
  ElMessage.success(val ? '日志记录已启用' : '日志记录已关闭')
}

// Scheduler status
const schedulerStatus = ref(null)
const schedulerLoading = ref(false)

const loadSchedulerStatus = async (silent = false) => {
  if (!silent) schedulerLoading.value = true
  try {
    const res = await configApi.schedulerStatus()
    schedulerStatus.value = res?.data || null
  } finally {
    if (!silent) schedulerLoading.value = false
  }
}

const stopSchedulerPolling = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}

const startSchedulerPolling = async () => {
  stopSchedulerPolling()
  await loadSchedulerStatus()
  schedulerTimer = setInterval(() => {
    loadSchedulerStatus(true)
  }, 5000)
}

watch(activeTab, (tab) => {
  if (tab === 'logs') loadLogs()
  if (tab === 'scheduler') startSchedulerPolling()
  else stopSchedulerPolling()
})

onMounted(() => { loadLlmProviders(); loadConfigs(); loadPrompts() })
onBeforeUnmount(() => { stopSchedulerPolling() })
</script>

<style scoped>
.unit { margin-left: 8px; color: #666; }
</style>
