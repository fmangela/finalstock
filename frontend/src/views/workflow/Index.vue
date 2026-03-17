<template>
  <div class="workflow-page">
    <el-tabs v-model="activeTab" type="border-card">

      <!-- ── 第一步：LLM 自动选股 ── -->
      <el-tab-pane label="① LLM 自动选股" name="pick">
        <el-form :model="cfg" label-width="160px" style="max-width:700px">
          <el-form-item label="每日自动选股次数">
            <el-input-number v-model="cfg.pick_daily_count" :min="1" :max="10" />
            <span class="hint">次/天（定时任务按此频率触发）</span>
          </el-form-item>
          <el-form-item label="选股提示词">
            <el-select v-model="cfg.pick_prompt_id" placeholder="请选择提示词" style="width:300px">
              <el-option v-for="p in prompts" :key="p.id" :label="p.name" :value="String(p.id)" />
            </el-select>
          </el-form-item>
          <el-form-item label="观测周期">
            <el-select v-model="cfg.pick_observation_period" style="width:160px">
              <el-option label="一周" value="一周" />
              <el-option label="一月" value="一月" />
              <el-option label="一年" value="一年" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveConfig">保存配置</el-button>
            <el-button type="success" :loading="running.pick" @click="runPickStock">立即执行选股</el-button>
          </el-form-item>
        </el-form>
        <el-alert v-if="result.pick" :title="result.pick" type="success" show-icon style="margin-top:12px;max-width:700px" />
      </el-tab-pane>

      <!-- ── 第二步：股票自动回测 ── -->
      <el-tab-pane label="② 股票自动回测" name="backtest">
        <el-form :model="cfg" label-width="200px" style="max-width:800px">
          <el-form-item label="选股范围（历史天数）">
            <el-input-number v-model="cfg.backtest_history_days" :min="0" :max="30" />
            <span class="hint">0=仅当日，N=当日+过去N天的选股</span>
          </el-form-item>
          <el-form-item label="回测策略（多选）">
            <el-checkbox-group v-model="selectedStrategies">
              <el-checkbox v-for="s in strategies" :key="s.name" :label="s.name">{{ s.displayName }}</el-checkbox>
            </el-checkbox-group>
          </el-form-item>

          <!-- 每个策略的参数范围 -->
          <template v-for="s in strategies" :key="'params-'+s.name">
            <template v-if="selectedStrategies.includes(s.name)">
              <el-divider content-position="left">{{ s.displayName }} 参数范围</el-divider>
              <template v-for="(val, key) in s.defaultParams" :key="key">
                <el-form-item :label="key">
                  <el-input-number
                    v-model="strategyParamRanges[s.name][key].min"
                    :step="1" placeholder="最小值" style="width:120px" />
                  <span style="margin:0 8px">~</span>
                  <el-input-number
                    v-model="strategyParamRanges[s.name][key].max"
                    :step="1" placeholder="最大值" style="width:120px" />
                  <span style="margin:0 8px">步长</span>
                  <el-input-number
                    v-model="strategyParamRanges[s.name][key].step"
                    :min="1" :step="1" style="width:100px" />
                  <span class="hint">默认值: {{ val }}</span>
                </el-form-item>
              </template>
            </template>
          </template>

          <el-divider content-position="left">回测资金与过滤</el-divider>
          <el-form-item label="回测初始资金">
            <el-input-number v-model="cfg.backtest_initial_capital" :min="10000" :step="10000" />
            <span class="hint">元</span>
          </el-form-item>
          <el-form-item label="删除低收益记录">
            <el-switch v-model="cfg.backtest_delete_low_return" active-value="1" inactive-value="0" />
            <span style="margin-left:12px">收益率低于</span>
            <el-input-number v-model="cfg.backtest_low_return_threshold" :step="1" style="width:120px;margin:0 6px" />
            <span>%</span>
          </el-form-item>
          <el-form-item label="删除低胜率记录">
            <el-switch v-model="cfg.backtest_delete_low_win_rate" active-value="1" inactive-value="0" />
            <span style="margin-left:12px">胜率低于</span>
            <el-input-number v-model="cfg.backtest_low_win_rate_threshold" :min="0" :max="100" :step="5" style="width:120px;margin:0 6px" />
            <span>%</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveConfig">保存配置</el-button>
            <el-button type="success" :loading="running.backtest" @click="runBacktest">立即执行回测</el-button>
          </el-form-item>
        </el-form>
        <el-alert v-if="result.backtest" :title="result.backtest" type="success" show-icon style="margin-top:12px;max-width:800px" />
      </el-tab-pane>

      <!-- ── 第三步：自动模拟交易 ── -->
      <el-tab-pane label="③ 自动模拟交易" name="simulation">
        <el-form :model="cfg" label-width="200px" style="max-width:700px">
          <el-form-item label="自动交易初始资金">
            <el-input-number v-model="cfg.sim_initial_capital" :min="10000" :step="10000" />
            <span class="hint">元（每个模拟交易任务的初始资金）</span>
          </el-form-item>
          <el-form-item label="最低收益率门槛">
            <el-input-number v-model="cfg.sim_min_return_threshold" :step="1" style="width:140px" />
            <span class="hint">%（回测收益率高于此值才创建模拟交易）</span>
          </el-form-item>
          <el-form-item label="最低胜率门槛">
            <el-input-number v-model="cfg.sim_min_win_rate_threshold" :min="0" :max="100" :step="5" style="width:140px" />
            <span class="hint">%（回测胜率高于此值才创建模拟交易）</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveConfig">保存配置</el-button>
            <el-button type="success" :loading="running.simulation" @click="runSimulation">立即创建模拟交易</el-button>
          </el-form-item>
        </el-form>
        <el-alert v-if="result.simulation" :title="result.simulation" type="success" show-icon style="margin-top:12px;max-width:700px" />
      </el-tab-pane>

      <!-- ── 第四步：开始自动 ── -->
      <el-tab-pane label="④ 开始自动" name="auto">
        <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap">

          <!-- 左侧：配置表单 -->
          <el-form :model="cfg" label-width="160px" style="width:520px;flex-shrink:0">

            <el-form-item label="启用自动流程">
              <el-switch
                v-model="cfg.auto_enabled"
                active-value="1" inactive-value="0"
                active-text="已开启" inactive-text="已关闭"
                style="--el-switch-on-color:#13ce66"
              />
            </el-form-item>

            <el-divider content-position="left">执行时间</el-divider>

            <el-form-item label="跳过非交易日">
              <el-switch v-model="cfg.auto_skip_non_trading" active-value="1" inactive-value="0" />
              <span class="hint">自动识别 A 股节假日、调休，非交易日不执行</span>
            </el-form-item>

            <el-form-item label="每日执行次数">
              <el-input-number v-model="cfg.pick_daily_count" :min="1" :max="6" @change="autoGenTimeslots" />
              <span class="hint">修改后自动生成时间点</span>
            </el-form-item>

            <el-form-item label="执行时间点">
              <div class="timeslot-list">
                <div v-for="(slot, idx) in autoTimeslots" :key="idx" class="timeslot-row">
                  <el-time-picker
                    v-model="autoTimeslots[idx]"
                    format="HH:mm"
                    value-format="HH:mm"
                    :clearable="false"
                    style="width:130px"
                  />
                  <el-button
                    v-if="autoTimeslots.length > 1"
                    type="danger" text circle size="small"
                    style="margin-left:6px"
                    @click="autoTimeslots.splice(idx, 1)"
                  >
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
                <el-button type="primary" text size="small" @click="autoTimeslots.push('10:00')" style="margin-top:4px">
                  + 添加时间点
                </el-button>
              </div>
            </el-form-item>

            <el-divider content-position="left">执行步骤</el-divider>

            <el-form-item label="执行 LLM 选股">
              <el-switch v-model="cfg.auto_run_pick" active-value="1" inactive-value="0" />
            </el-form-item>
            <el-form-item label="执行自动回测">
              <el-switch v-model="cfg.auto_run_backtest" active-value="1" inactive-value="0" />
            </el-form-item>
            <el-form-item label="执行自动模拟交易">
              <el-switch v-model="cfg.auto_run_simulation" active-value="1" inactive-value="0" />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="saveAutoConfig">保存并应用</el-button>
            </el-form-item>

            <!-- 当前调度状态 -->
            <el-alert v-if="cfg.auto_enabled === '1'" type="success" :closable="false" show-icon style="margin-top:4px">
              <template #title>
                自动流程已开启，每日
                <el-tag v-for="t in autoTimeslots" :key="t" size="small" type="success" style="margin:0 3px">{{ t }}</el-tag>
                执行
                <template v-if="cfg.auto_skip_non_trading !== '0'">（非交易日自动跳过）</template>
              </template>
            </el-alert>
            <el-alert v-else type="info" :closable="false" show-icon title="自动流程未开启" style="margin-top:4px" />
          </el-form>

          <!-- 右侧：交易日历预览 -->
          <div style="flex:1;min-width:320px">
            <div class="calendar-header">
              <el-button text circle @click="calendarPrev"><el-icon><ArrowLeft /></el-icon></el-button>
              <span class="calendar-title">{{ calYear }} 年 {{ calMonth }} 月</span>
              <el-button text circle @click="calendarNext"><el-icon><ArrowRight /></el-icon></el-button>
            </div>
            <div class="calendar-legend">
              <span class="legend-dot trading"></span>交易日
              <span class="legend-dot holiday" style="margin-left:12px"></span>节假日
              <span class="legend-dot weekend" style="margin-left:12px"></span>周末
              <span class="legend-dot extra" style="margin-left:12px"></span>调休交易
            </div>
            <div class="cal-grid">
              <div class="cal-weekday" v-for="w in ['一','二','三','四','五','六','日']" :key="w">{{ w }}</div>
              <!-- 月首空格 -->
              <div v-for="n in calStartOffset" :key="'e'+n" class="cal-cell empty"></div>
              <!-- 日期格子 -->
              <div
                v-for="day in calendarDays" :key="day.date"
                class="cal-cell"
                :class="{
                  'is-trading': day.trading,
                  'is-holiday': !day.trading && day.note === '节假日',
                  'is-weekend':  !day.trading && day.note === '周末',
                  'is-extra':    day.trading  && day.note === '调休交易',
                  'is-today':    day.date === todayStr
                }"
                :title="day.note || (day.trading ? '交易日' : '')"
              >
                <span class="cal-day-num">{{ day.date.slice(8) }}</span>
                <span v-if="day.note === '调休交易'" class="cal-badge">调</span>
                <span v-if="day.note === '节假日'" class="cal-badge holiday-badge">休</span>
              </div>
            </div>
            <div class="calendar-stat">
              本月交易日 <strong>{{ calTradingCount }}</strong> 天，
              休市 <strong>{{ calendarDays.length - calTradingCount }}</strong> 天
            </div>
          </div>

        </div>
      </el-tab-pane>

    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { workflowApi } from '@/api/index.js'

const activeTab = ref('pick')
const prompts = ref([])
const strategies = ref([])
const selectedStrategies = ref([])
const strategyParamRanges = reactive({})

// 自动流程专属状态
const autoTimeslots = ref(['10:00'])

// 交易日历状态
const calYear = ref(new Date().getFullYear())
const calMonth = ref(new Date().getMonth() + 1)
const calendarDays = ref([])
const todayStr = new Date().toISOString().slice(0, 10)

const cfg = reactive({
  pick_daily_count: 1,
  pick_prompt_id: '',
  pick_observation_period: '一月',
  backtest_history_days: 0,
  backtest_initial_capital: 100000,
  backtest_delete_low_return: '0',
  backtest_low_return_threshold: -10,
  backtest_delete_low_win_rate: '0',
  backtest_low_win_rate_threshold: 30,
  sim_initial_capital: 100000,
  sim_min_return_threshold: 0,
  sim_min_win_rate_threshold: 50,
  auto_enabled: '0',
  auto_skip_non_trading: '1',
  auto_run_pick: '1',
  auto_run_backtest: '1',
  auto_run_simulation: '1'
})

const running = reactive({ pick: false, backtest: false, simulation: false })
const result = reactive({ pick: '', backtest: '', simulation: '' })

// 日历计算属性
const calStartOffset = computed(() => {
  const d = new Date(calYear.value, calMonth.value - 1, 1)
  const dow = d.getDay()
  return dow === 0 ? 6 : dow - 1
})

const calTradingCount = computed(() => {
  return calendarDays.value.filter(d => d.trading).length
})

// 根据每日次数自动生成均匀分布的时间点
function autoGenTimeslots(count) {
  const n = count || cfg.pick_daily_count
  const slots = []
  const intervalHours = Math.max(1, Math.floor(5.5 / n))
  for (let i = 0; i < n; i++) {
    const h = 10 + i * intervalHours
    if (h < 15) slots.push(`${String(h).padStart(2, '0')}:00`)
  }
  autoTimeslots.value = slots.length > 0 ? slots : ['10:00']
}

function initStrategyParamRanges(strategyList) {
  for (const s of strategyList) {
    if (!strategyParamRanges[s.name]) strategyParamRanges[s.name] = {}
    for (const [key, val] of Object.entries(s.defaultParams || {})) {
      if (!strategyParamRanges[s.name][key]) {
        strategyParamRanges[s.name][key] = { min: val, max: val, step: 1 }
      }
    }
  }
}

// 加载交易日历
async function loadCalendar() {
  try {
    const res = await workflowApi.getCalendar(calYear.value, calMonth.value)
    if (res.code === 0) calendarDays.value = res.data
  } catch (e) {
    console.error('加载日历失败:', e)
  }
}

function calendarPrev() {
  calMonth.value--
  if (calMonth.value < 1) { calMonth.value = 12; calYear.value-- }
  loadCalendar()
}

function calendarNext() {
  calMonth.value++
  if (calMonth.value > 12) { calMonth.value = 1; calYear.value++ }
  loadCalendar()
}

onMounted(async () => {
  try {
    const [cfgRes, promptRes, stratRes] = await Promise.all([
      workflowApi.getConfig(),
      workflowApi.getPrompts(),
      workflowApi.getStrategies()
    ])
    if (cfgRes.code === 0) {
      const data = cfgRes.data
      const numKeys = ['pick_daily_count', 'backtest_history_days', 'backtest_initial_capital',
        'backtest_low_return_threshold', 'backtest_low_win_rate_threshold',
        'sim_initial_capital', 'sim_min_return_threshold', 'sim_min_win_rate_threshold']
      Object.keys(cfg).forEach(k => {
        if (data[k] !== undefined) cfg[k] = numKeys.includes(k) ? parseFloat(data[k]) : data[k]
      })
      if (data.backtest_strategies) {
        try { selectedStrategies.value = JSON.parse(data.backtest_strategies) } catch {}
      }
      if (data.backtest_strategy_params) {
        try { Object.assign(strategyParamRanges, JSON.parse(data.backtest_strategy_params)) } catch {}
      }
      if (data.auto_timeslots) {
        try { autoTimeslots.value = JSON.parse(data.auto_timeslots) } catch {}
      }
    }
    if (promptRes.code === 0) prompts.value = promptRes.data
    if (stratRes.code === 0) {
      strategies.value = stratRes.data.filter(s => s.name !== 'ma_cross')
      initStrategyParamRanges(strategies.value)
    }
  } catch (e) {
    ElMessage.error('加载配置失败: ' + e.message)
  }

  // 加载交易日历
  loadCalendar()
})

async function saveConfig() {
  try {
    const payload = {
      ...cfg,
      backtest_strategies: JSON.stringify(selectedStrategies.value),
      backtest_strategy_params: JSON.stringify(strategyParamRanges),
      auto_timeslots: JSON.stringify(autoTimeslots.value)
    }
    Object.keys(payload).forEach(k => { payload[k] = String(payload[k]) })
    const res = await workflowApi.saveConfig(payload)
    if (res.code === 0) ElMessage.success('配置已保存')
    else ElMessage.error(res.message)
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
  }
}

// 保存自动流程配置并重载调度
async function saveAutoConfig() {
  await saveConfig()
  try {
    const res = await workflowApi.reloadSchedule()
    if (res.code === 0) ElMessage.success('调度已应用，自动流程' + (cfg.auto_enabled === '1' ? '已开启' : '已关闭'))
    else ElMessage.error(res.message)
  } catch (e) {
    ElMessage.error('重载调度失败: ' + e.message)
  }
}

async function runPickStock() {
  running.pick = true
  result.pick = ''
  try {
    await saveConfig()
    const res = await workflowApi.runPickStock()
    if (res.code === 0) {
      result.pick = `选股完成，保存 ${res.data.saved} 只股票`
      ElMessage.success(result.pick)
    } else ElMessage.error(res.message)
  } catch (e) {
    ElMessage.error('执行失败: ' + e.message)
  } finally {
    running.pick = false
  }
}

async function runBacktest() {
  if (selectedStrategies.value.length === 0) { ElMessage.warning('请至少选择一个回测策略'); return }
  running.backtest = true
  result.backtest = ''
  try {
    await saveConfig()
    const res = await workflowApi.runBacktest()
    if (res.code === 0) {
      result.backtest = `回测完成：执行 ${res.data.ran} 次，跳过重复 ${res.data.skipped} 次，删除低质量 ${res.data.deleted} 条`
      ElMessage.success(result.backtest)
    } else ElMessage.error(res.message)
  } catch (e) {
    ElMessage.error('执行失败: ' + e.message)
  } finally {
    running.backtest = false
  }
}

async function runSimulation() {
  running.simulation = true
  result.simulation = ''
  try {
    await saveConfig()
    const res = await workflowApi.runSimulation()
    if (res.code === 0) {
      result.simulation = `模拟交易：新建 ${res.data.created} 个任务，跳过已有 ${res.data.skipped} 个`
      ElMessage.success(result.simulation)
    } else ElMessage.error(res.message)
  } catch (e) {
    ElMessage.error('执行失败: ' + e.message)
  } finally {
    running.simulation = false
  }
}
</script>

<style scoped>
.workflow-page { padding: 4px; }
.hint { color: #999; font-size: 12px; margin-left: 10px; }
.timeslot-list { display: flex; flex-direction: column; gap: 6px; }
.timeslot-row { display: flex; align-items: center; }

/* 交易日历 */
.calendar-header {
  display: flex; align-items: center; justify-content: center;
  gap: 12px; margin-bottom: 8px;
}
.calendar-title { font-size: 15px; font-weight: 600; min-width: 110px; text-align: center; }
.calendar-legend {
  display: flex; align-items: center; font-size: 12px; color: #666;
  margin-bottom: 8px; gap: 4px;
}
.legend-dot {
  display: inline-block; width: 10px; height: 10px; border-radius: 50%;
}
.legend-dot.trading  { background: #67c23a; }
.legend-dot.holiday  { background: #f56c6c; }
.legend-dot.weekend  { background: #dcdfe6; }
.legend-dot.extra    { background: #e6a23c; }

.cal-grid {
  display: grid; grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}
.cal-weekday {
  text-align: center; font-size: 12px; color: #909399;
  padding: 4px 0; font-weight: 600;
}
.cal-cell {
  position: relative;
  min-height: 36px; border-radius: 6px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-size: 13px; cursor: default;
  background: #f5f7fa;
}
.cal-cell.empty { background: transparent; }
.cal-cell.is-trading  { background: #f0f9eb; color: #67c23a; font-weight: 600; }
.cal-cell.is-holiday  { background: #fef0f0; color: #f56c6c; }
.cal-cell.is-weekend  { background: #f5f7fa; color: #c0c4cc; }
.cal-cell.is-extra    { background: #fdf6ec; color: #e6a23c; font-weight: 600; }
.cal-cell.is-today    { outline: 2px solid #409eff; outline-offset: -2px; }

.cal-day-num { line-height: 1; }
.cal-badge {
  font-size: 9px; line-height: 1; margin-top: 2px;
  background: #67c23a; color: #fff; border-radius: 3px; padding: 1px 3px;
}
.cal-badge.holiday-badge { background: #f56c6c; }

.calendar-stat {
  margin-top: 8px; font-size: 12px; color: #909399; text-align: center;
}
</style>
