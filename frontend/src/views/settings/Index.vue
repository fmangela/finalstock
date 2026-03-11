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
          <el-form :model="llmForm" label-width="120px" style="max-width:560px">
            <el-form-item label="预设模型">
              <el-select v-model="llmPreset" placeholder="选择预设" clearable @change="applyPreset" style="width:100%">
                <el-option v-for="p in llmPresets" :key="p.value" :label="p.label" :value="p.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="API地址">
              <el-input v-model="llmForm.api_url" placeholder="https://api.openai.com/v1/chat/completions" />
            </el-form-item>
            <el-form-item label="API Key">
              <el-input v-model="llmForm.api_key" type="password" show-password />
            </el-form-item>
            <el-form-item label="模型名称">
              <el-input v-model="llmForm.model_name" placeholder="gpt-4" />
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
            <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
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

        <!-- 新闻源 -->
        <el-tab-pane label="新闻源" name="news">
          <el-form :model="configs.news" label-width="130px" style="max-width:600px">
            <el-form-item label="新闻来源">
              <el-checkbox-group v-model="newsSources">
                <el-checkbox label="eastmoney">东方财富</el-checkbox>
                <el-checkbox label="cls">财联社</el-checkbox>
                <el-checkbox label="ths">同花顺</el-checkbox>
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
    <el-dialog v-model="promptDialogVisible" :title="promptForm.id ? '编辑提示词' : '新增提示词'" width="560px">
      <el-form :model="promptForm" label-width="100px">
        <el-form-item label="名称"><el-input v-model="promptForm.name" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="promptForm.content" type="textarea" :rows="6" /></el-form-item>
        <el-form-item label="匹配股市">
          <el-select v-model="promptForm.market_type">
            <el-option label="A股" value="A股" />
            <el-option label="港股" value="港股" />
            <el-option label="美股" value="美股" />
          </el-select>
        </el-form-item>
        <el-form-item label="推送要闻"><el-switch v-model="promptForm.push_news" /></el-form-item>
        <el-form-item label="推送股市信息"><el-switch v-model="promptForm.push_stock_info" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="promptDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePrompt" :loading="promptSaving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { configApi, llmConfigApi, promptApi } from '@/api'

const activeTab = ref('data_source')
const saving = ref(false)
const testing = ref(false)
const newsSources = ref([])
const configs = ref({
  data_source: { provider: 'akshare' },
  stock_filter: { turnover_rate_min: 2, turnover_rate_max: 20, pe_min: 5, pe_max: 50 },
  news: { sources: '[]', retention_days: 7 }
})

// LLM config
const llmForm = ref({ api_url: '', api_key: '', model_name: '' })
const llmPreset = ref('')
const llmPresets = [
  { label: '硅基流动 (SiliconFlow)', value: 'https://api.siliconflow.cn/v1/chat/completions' },
  { label: '百度文心一言', value: 'https://qianfan.baidubce.com/v2/chat/completions' },
  { label: '阿里通义千问', value: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' },
  { label: '智谱GLM', value: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
  { label: '腾讯混元', value: 'https://hunyuan.cloud.tencent.com/api/v3/chat/completions' },
  { label: '月之暗面(Moonshot)', value: 'https://api.moonshot.cn/v1/chat/completions' },
  { label: '百川智能', value: 'https://api.baichuan-ai.com/v1/chat/completions' },
  { label: 'OpenAI', value: 'https://api.openai.com/v1/chat/completions' }
]

const applyPreset = (url) => { if (url) llmForm.value.api_url = url }

const saveLlmConfig = async () => {
  saving.value = true
  try {
    await llmConfigApi.save(llmForm.value)
    ElMessage.success('保存成功')
  } finally {
    saving.value = false
  }
}

const testLlmConfig = async () => {
  testing.value = true
  try {
    const res = await llmConfigApi.test()
    if (res?.code === 0) ElMessage.success(res.message)
    else ElMessage.error(res?.message || '连接失败')
  } catch (e) {
    ElMessage.error('请求失败：' + e.message)
  } finally {
    testing.value = false
  }
}

// Prompts
const prompts = ref([])
const promptsLoading = ref(false)
const promptDialogVisible = ref(false)
const promptSaving = ref(false)
const promptForm = ref({ id: null, name: '', content: '', market_type: 'A股', push_news: false, push_stock_info: false })

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
    promptForm.value = { id: row.id, name: row.name, content: row.content, market_type: row.market_type, push_news: row.push_news, push_stock_info: row.push_stock_info }
  } else {
    promptForm.value = { id: null, name: '', content: '', market_type: 'A股', push_news: false, push_stock_info: false }
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
        try { newsSources.value = JSON.parse(d.news.sources) } catch { newsSources.value = [] }
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
  }
  if (llmRes?.data) {
    llmForm.value = { api_url: llmRes.data.api_url || '', api_key: llmRes.data.api_key || '', model_name: llmRes.data.model_name || '' }
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

onMounted(() => { loadConfigs(); loadPrompts() })
</script>

<style scoped>
.unit { margin-left: 8px; color: #666; }
</style>
