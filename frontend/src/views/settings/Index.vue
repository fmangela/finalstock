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
        <el-tab-pane label="LLM配置" name="llm">
          <el-form :model="configs.llm" label-width="120px" style="max-width:500px">
            <el-form-item label="API地址">
              <el-input v-model="configs.llm.api_url" placeholder="https://api.openai.com/v1" />
            </el-form-item>
            <el-form-item label="API Key">
              <el-input v-model="configs.llm.api_key" type="password" show-password />
            </el-form-item>
            <el-form-item label="模型">
              <el-input v-model="configs.llm.model" placeholder="gpt-4" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveGroup('llm')" :loading="saving">保存</el-button>
            </el-form-item>
          </el-form>
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
                <el-input-number
                  v-model="syncConfig.period_value"
                  :min="periodValueMin"
                  :max="periodValueMax"
                  :step="1"
                />
                <span class="unit">{{ periodUnitLabel }}</span>
              </el-form-item>
              <el-form-item label="Cron 表达式">
                <el-tag type="info">{{ previewCron }}</el-tag>
              </el-form-item>
              <el-form-item label="起始时间">
                <el-date-picker
                  v-model="syncConfig.start_time"
                  type="datetime"
                  placeholder="默认当前时间"
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="x"
                  style="width:220px"
                />
              </el-form-item>
              <el-form-item label="终止时间">
                <el-checkbox v-model="syncConfig.no_end">无限</el-checkbox>
                <el-date-picker
                  v-if="!syncConfig.no_end"
                  v-model="syncConfig.end_time"
                  type="datetime"
                  placeholder="选择终止时间"
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="x"
                  style="width:220px; margin-left:12px"
                />
              </el-form-item>
            </template>

            <el-form-item>
              <el-button type="primary" @click="saveNewsSettings" :loading="saving">保存</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { configApi } from '@/api'

const activeTab = ref('data_source')
const saving = ref(false)
const newsSources = ref([])
const configs = ref({
  data_source: { provider: 'akshare' },
  llm: { api_url: '', api_key: '', model: 'gpt-4' },
  stock_filter: { turnover_rate_min: 2, turnover_rate_max: 20, pe_min: 5, pe_max: 50 },
  news: { sources: '[]', retention_days: 7 }
})

const syncConfig = ref({
  enabled: false,
  period_type: 'hour',
  period_value: 6,
  start_time: Date.now(),
  end_time: null,
  no_end: true
})

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
  const res = await configApi.getAll()
  if (res?.data) {
    const d = res.data
    if (d.data_source) configs.value.data_source = { ...configs.value.data_source, ...d.data_source }
    if (d.llm) configs.value.llm = { ...configs.value.llm, ...d.llm }
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

      // 加载同步周期配置
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

    // 通知后端重新加载调度
    await configApi.reloadSync()
    ElMessage.success('保存成功，调度已更新')
  } catch (e) {
    ElMessage.error('保存失败：' + (e.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

onMounted(loadConfigs)
</script>

<style scoped>
.unit { margin-left: 8px; color: #666; }
</style>
