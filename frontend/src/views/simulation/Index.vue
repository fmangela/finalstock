<template>
  <div>
    <!-- 汇总卡片 -->
    <el-row :gutter="16" class="mb-4">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">总投入</div>
          <div class="stat-value">{{ formatMoney(summary.totalCapital) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">当前市值</div>
          <div class="stat-value">{{ formatMoney(summary.totalValue) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">总盈亏</div>
          <div class="stat-value" :class="summary.totalPL >= 0 ? 'up' : 'down'">
            {{ formatMoney(summary.totalPL) }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">运行中任务</div>
          <div class="stat-value">{{ summary.runningCount }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 任务列表 -->
    <el-card shadow="hover">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>模拟交易任务</span>
          <el-button type="primary" @click="openCreate">新建任务</el-button>
        </div>
      </template>

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <el-checkbox v-model="selectAll" :indeterminate="isIndeterminate" @change="handleSelectAll">全选</el-checkbox>
        <span v-if="selectedRows.length > 0" style="color:#909399;font-size:13px">已选 {{ selectedRows.length }} 条</span>
        <el-button size="small" type="warning" @click="batchPause" :disabled="selectedRows.filter(r=>r.status==='running').length===0">批量暂停</el-button>
        <el-button size="small" type="success" @click="batchResume" :disabled="selectedRows.filter(r=>r.status==='paused').length===0">批量恢复</el-button>
        <el-button size="small" type="info" @click="batchStop" :disabled="selectedRows.filter(r=>r.status!=='stopped').length===0">批量停止</el-button>
        <el-button size="small" type="danger" @click="batchDelete" :disabled="selectedRows.length===0">批量删除</el-button>
      </div>

      <el-table :data="tasks" v-loading="loading" stripe @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="stock_code" label="代码" width="90" />
        <el-table-column prop="stock_name" label="名称" width="100" />
        <el-table-column label="策略" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.strategy_type.toUpperCase() }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="初始资金" width="110">
          <template #default="{ row }">{{ formatMoney(row.initial_capital) }}</template>
        </el-table-column>
        <el-table-column label="现金余额" width="110">
          <template #default="{ row }">{{ formatMoney(row.cash_balance) }}</template>
        </el-table-column>
        <el-table-column label="持股" width="80">
          <template #default="{ row }">{{ row.shares > 0 ? row.shares + '股' : '-' }}</template>
        </el-table-column>
        <el-table-column label="总收益率" width="100">
          <template #default="{ row }">
            <span :class="Number(row.total_return) >= 0 ? 'up' : 'down'">
              {{ Number(row.total_return || 0).toFixed(2) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="最大回撤" width="100">
          <template #default="{ row }">
            <span class="down">{{ Number(row.max_drawdown || 0).toFixed(2) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="胜率" width="90">
          <template #default="{ row }">
            {{ row.total_trades > 0 ? ((row.win_trades / row.total_trades) * 100).toFixed(1) : '-' }}%
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近执行" width="110">
          <template #default="{ row }">{{ row.last_run_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="goDetail(row.id)">详情</el-button>
            <el-button size="small" type="warning" @click="toggleStatus(row)"
              v-if="row.status !== 'stopped'">
              {{ row.status === 'running' ? '暂停' : '恢复' }}
            </el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建对话框 -->
    <el-dialog v-model="createVisible" title="新建模拟交易" width="560px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="选择股票">
          <el-select v-model="form.stock_code" placeholder="从LLM选股中选择" filterable style="width:100%"
            @change="onStockChange">
            <el-option v-for="s in stockList" :key="s.stock_code"
              :label="`${s.stock_name} (${s.stock_code})`" :value="s.stock_code" />
          </el-select>
        </el-form-item>
        <el-form-item label="初始资金">
          <el-input-number v-model="form.capital" :min="10000" :step="10000" style="width:100%" />
        </el-form-item>
        <el-form-item label="选择策略">
          <el-select v-model="form.strategy_type" style="width:100%" @change="onStrategyTypeChange">
            <el-option label="MA 均线交叉" value="ma" />
            <el-option label="RSI 相对强弱" value="rsi" />
            <el-option label="MACD 指数平滑" value="macd" />
            <el-option label="BOLL 布林带" value="boll" />
            <el-option label="Breakout 突破" value="breakout" />
          </el-select>
        </el-form-item>
        <el-form-item label="策略实例" v-if="instanceList.length > 0">
          <el-select v-model="form.instance_id" placeholder="可选：加载已保存的参数" clearable
            style="width:100%" @change="onInstanceChange">
            <el-option v-for="ins in instanceList" :key="ins.id" :label="ins.name" :value="ins.id" />
          </el-select>
        </el-form-item>

        <!-- 策略参数 -->
        <template v-if="form.strategy_type === 'ma'">
          <el-form-item label="短期均线">
            <el-input-number v-model="form.params.short_period" :min="1" :max="60" style="width:100%" />
          </el-form-item>
          <el-form-item label="长期均线">
            <el-input-number v-model="form.params.long_period" :min="5" :max="120" style="width:100%" />
          </el-form-item>
        </template>
        <template v-if="form.strategy_type === 'rsi'">
          <el-form-item label="RSI周期">
            <el-input-number v-model="form.params.rsi_period" :min="1" :max="30" style="width:100%" />
          </el-form-item>
          <el-form-item label="超卖阈值">
            <el-input-number v-model="form.params.oversold" :min="10" :max="50" style="width:100%" />
          </el-form-item>
          <el-form-item label="超买阈值">
            <el-input-number v-model="form.params.overbought" :min="50" :max="90" style="width:100%" />
          </el-form-item>
        </template>
        <template v-if="form.strategy_type === 'macd'">
          <el-form-item label="快线周期">
            <el-input-number v-model="form.params.fast_period" :min="1" :max="30" style="width:100%" />
          </el-form-item>
          <el-form-item label="慢线周期">
            <el-input-number v-model="form.params.slow_period" :min="5" :max="60" style="width:100%" />
          </el-form-item>
          <el-form-item label="信号线周期">
            <el-input-number v-model="form.params.signal_period" :min="1" :max="20" style="width:100%" />
          </el-form-item>
        </template>
        <template v-if="form.strategy_type === 'boll'">
          <el-form-item label="布林带周期">
            <el-input-number v-model="form.params.boll_period" :min="5" :max="50" style="width:100%" />
          </el-form-item>
          <el-form-item label="标准差倍数">
            <el-input-number v-model="form.params.std_dev" :min="1" :max="4" :step="0.5" style="width:100%" />
          </el-form-item>
        </template>
        <template v-if="form.strategy_type === 'breakout'">
          <el-form-item label="突破周期">
            <el-input-number v-model="form.params.breakout_period" :min="5" :max="60" style="width:100%" />
          </el-form-item>
        </template>

        <el-divider>止盈止损</el-divider>
        <el-form-item label="止损比例">
          <el-input-number v-model="form.params.stop_loss_pct" :min="0.01" :max="0.5" :step="0.01" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="止盈比例">
          <el-input-number v-model="form.params.take_profit_pct" :min="0.01" :max="1" :step="0.01" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="交易时机">
          <el-radio-group v-model="form.trade_timing">
            <el-radio value="pre_open">盘前买入 (9:25)</el-radio>
            <el-radio value="pre_close">收盘前买入 (14:55)</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate" :loading="submitting">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { simApi, strategyApi } from '@/api'

const router = useRouter()
const tasks = ref([])
const stockList = ref([])
const instanceList = ref([])
const loading = ref(false)
const createVisible = ref(false)
const submitting = ref(false)
const selectedRows = ref([])
const selectAll = ref(false)

const isIndeterminate = computed(() =>
  selectedRows.value.length > 0 && selectedRows.value.length < tasks.value.length
)

const handleSelectionChange = (rows) => { selectedRows.value = rows }

const handleSelectAll = (val) => { selectedRows.value = val ? [...tasks.value] : [] }

const defaultParams = () => ({
  short_period: 5, long_period: 20,
  rsi_period: 14, oversold: 30, overbought: 70,
  fast_period: 12, slow_period: 26, signal_period: 9,
  boll_period: 20, std_dev: 2,
  breakout_period: 20,
  stop_loss_pct: 0.05, take_profit_pct: 0.15
})

const form = ref({
  stock_code: '', stock_name: '',
  capital: 100000,
  strategy_type: 'ma',
  instance_id: null,
  params: defaultParams(),
  trade_timing: 'pre_close'
})

const summary = computed(() => {
  let totalCapital = 0, totalValue = 0, runningCount = 0
  for (const t of tasks.value) {
    totalCapital += parseFloat(t.initial_capital) || 0
    totalValue += parseFloat(t.cash_balance) || 0
    if (t.status === 'running') runningCount++
  }
  return { totalCapital, totalValue, totalPL: totalValue - totalCapital, runningCount }
})

const formatMoney = (val) => {
  if (val === null || val === undefined) return '-'
  const n = Number(val)
  return (n >= 0 ? '¥' : '-¥') + Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

const statusType = (s) => ({ running: 'success', paused: 'warning', stopped: 'info' }[s] || 'info')
const statusLabel = (s) => ({ running: '运行中', paused: '已暂停', stopped: '已停止' }[s] || s)

const loadTasks = async () => {
  loading.value = true
  try {
    const res = await simApi.getTasks()
    tasks.value = res?.data || []
  } finally {
    loading.value = false
  }
}

const onStrategyTypeChange = async (type) => {
  form.value.instance_id = null
  form.value.params = defaultParams()
  // 加载该策略类型对应的实例
  const strategies = { ma: 'ma', rsi: 'rsi', macd: 'macd', boll: 'boll', breakout: 'breakout' }
  try {
    // 先拿策略列表找到对应 strategy_id
    const sRes = await strategyApi.getStrategies()
    const matched = (sRes?.data || []).find(s => s.strategy_type === type || s.strategy_type === strategies[type])
    if (matched) {
      const iRes = await strategyApi.getInstances({ strategy_id: matched.id })
      instanceList.value = iRes?.data || []
    } else {
      instanceList.value = []
    }
  } catch { instanceList.value = [] }
}

const onInstanceChange = (instanceId) => {
  if (!instanceId) return
  const ins = instanceList.value.find(i => i.id === instanceId)
  if (ins?.params_json) Object.assign(form.value.params, ins.params_json)
}

const openCreate = async () => {
  form.value = { stock_code: '', stock_name: '', capital: 100000, strategy_type: 'ma', instance_id: null, params: defaultParams(), trade_timing: 'pre_close' }
  instanceList.value = []
  createVisible.value = true
  const [stockRes, sRes] = await Promise.all([
    stockList.value.length === 0 ? simApi.getStocks() : Promise.resolve({ data: stockList.value }),
    strategyApi.getStrategies()
  ])
  stockList.value = stockRes?.data || []
  // 预加载默认策略(ma)的实例
  const matched = (sRes?.data || []).find(s => s.strategy_type === 'ma')
  if (matched) {
    const iRes = await strategyApi.getInstances({ strategy_id: matched.id })
    instanceList.value = iRes?.data || []
  }
}

const onStockChange = (code) => {
  const s = stockList.value.find(x => x.stock_code === code)
  if (s) form.value.stock_name = s.stock_name
}

const submitCreate = async () => {
  if (!form.value.stock_code) return ElMessage.warning('请选择股票')
  submitting.value = true
  try {
    await simApi.createTask({
      stock_code: form.value.stock_code,
      stock_name: form.value.stock_name,
      capital: form.value.capital,
      strategy_type: form.value.strategy_type,
      strategy_params: form.value.params,
      trade_timing: form.value.trade_timing
    })
    ElMessage.success('创建成功')
    createVisible.value = false
    await loadTasks()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

const toggleStatus = async (row) => {
  const newStatus = row.status === 'running' ? 'paused' : 'running'
  await simApi.updateTask(row.id, { status: newStatus })
  await loadTasks()
}

const confirmDelete = async (row) => {
  await ElMessageBox.confirm(`确认删除 ${row.stock_name}(${row.stock_code}) 的模拟交易任务？`, '确认删除', { type: 'warning' })
  await simApi.deleteTask(row.id)
  ElMessage.success('删除成功')
  await loadTasks()
}

const goDetail = (id) => router.push(`/finalstock/simulation/${id}`)

const batchPause = async () => {
  const targets = selectedRows.value.filter(r => r.status === 'running')
  for (const r of targets) await simApi.updateTask(r.id, { status: 'paused' })
  ElMessage.success(`已暂停 ${targets.length} 个任务`)
  selectedRows.value = []
  await loadTasks()
}

const batchResume = async () => {
  const targets = selectedRows.value.filter(r => r.status === 'paused')
  for (const r of targets) await simApi.updateTask(r.id, { status: 'running' })
  ElMessage.success(`已恢复 ${targets.length} 个任务`)
  selectedRows.value = []
  await loadTasks()
}

const batchStop = async () => {
  const targets = selectedRows.value.filter(r => r.status !== 'stopped')
  await ElMessageBox.confirm(`确认停止选中的 ${targets.length} 个任务？停止后不可恢复。`, '确认停止', { type: 'warning' })
  for (const r of targets) await simApi.updateTask(r.id, { status: 'stopped' })
  ElMessage.success(`已停止 ${targets.length} 个任务`)
  selectedRows.value = []
  await loadTasks()
}

const batchDelete = async () => {
  await ElMessageBox.confirm(`确认删除选中的 ${selectedRows.value.length} 个任务及其交易记录？`, '确认删除', { type: 'warning' })
  for (const r of selectedRows.value) await simApi.deleteTask(r.id)
  ElMessage.success(`已删除 ${selectedRows.value.length} 个任务`)
  selectedRows.value = []
  await loadTasks()
}

onMounted(loadTasks)
</script>

<style scoped>
.mb-4 { margin-bottom: 16px; }
.stat-card { text-align: center; padding: 8px 0; }
.stat-label { color: #909399; font-size: 13px; margin-bottom: 6px; }
.stat-value { font-size: 22px; font-weight: 600; }
.up { color: #f56c6c; }
.down { color: #67c23a; }
</style>
