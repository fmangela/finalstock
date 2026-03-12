<template>
  <div>
    <el-card shadow="hover">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>股票回测</span>
          <el-button type="primary" @click="openStockDialog">选择股票</el-button>
        </div>
      </template>

      <!-- 当前选股和信息 -->
      <div v-if="form.stock_code" class="selected-stock">
        <el-tag type="primary" size="large">{{ form.stock_name }} ({{ form.stock_code }})</el-tag>
        <el-button type="text" @click="openStockDialog">更换股票</el-button>
      </div>
      <div v-else class="tip-text">请点击"选择股票"按钮从LLM选股的股票中选择</div>

      <!-- 回测参数配置 -->
      <el-form :model="form" label-width="120px" style="margin-top:20px;max-width:600px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开始日期">
              <el-date-picker v-model="form.start_date" type="date" placeholder="选择开始日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束日期">
              <el-date-picker v-model="form.end_date" type="date" placeholder="选择结束日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="初始资金">
              <el-input-number v-model="form.initial_capital" :min="10000" :step="10000" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="策略参数">
              <el-select v-model="strategyPreset" placeholder="选择预设策略" clearable @change="applyStrategy" style="width:100%">
                <el-option label="均值交叉(5/20日)" value="ma_5_20" />
                <el-option label="均值交叉(10/30日)" value="ma_10_30" />
                <el-option label="均值交叉(20/60日)" value="ma_20_60" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="短期均线">
              <el-input-number v-model="form.ma_short" :min="1" :max="60" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="长期均线">
              <el-input-number v-model="form.ma_long" :min="5" :max="120" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="交易仓位">
              <el-slider v-model="form.position_pct" :min="10" :max="100" show-input />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="止损比例">
              <el-input-number v-model="form.stop_loss_pct" :min="0" :max="0.5" :step="0.01" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="止盈比例">
              <el-input-number v-model="form.take_profit_pct" :min="0" :max="1" :step="0.01" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="配置名称">
          <el-input v-model="form.config_name" placeholder="用于保存和加载回测配置" />
          <div style="margin-top:8px">
            <el-button @click="saveConfig" :loading="savingConfig">保存配置</el-button>
            <el-select v-model="selectedConfigId" placeholder="加载配置" clearable @change="loadConfig" style="width:200px;margin-left:10px">
              <el-option v-for="c in configList" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="runBacktest" :loading="running" :disabled="!form.stock_code || !form.start_date || !form.end_date">
            开始回测
          </el-button>
          <el-button @click="resetForm">重置参数</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 回测结果展示 -->
    <el-card v-if="result" shadow="hover" style="margin-top:16px">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>回测结果 - {{ result.stock_name }} ({{ result.stock_code }})</span>
          <el-button type="text" @click="result = null">关闭结果</el-button>
        </div>
      </template>

      <!-- 核心指标 -->
      <el-row :gutter="20" class="result-stats">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">总收益率</div>
            <div class="stat-value" :class="result.total_return >= 0 ? 'positive' : 'negative'">
              {{ result.total_return?.toFixed(2) }}%
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">年化收益率</div>
            <div class="stat-value" :class="result.annual_return >= 0 ? 'positive' : 'negative'">
              {{ result.annual_return?.toFixed(2) }}%
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">最大回撤</div>
            <div class="stat-value negative">{{ result.max_drawdown?.toFixed(2) }}%</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">夏普比率</div>
            <div class="stat-value">{{ result.sharpe_ratio?.toFixed(2) }}</div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="20" class="result-stats">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">总交易次数</div>
            <div class="stat-value">{{ result.total_trades }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">盈利次数</div>
            <div class="stat-value positive">{{ result.profit_trades }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">亏损次数</div>
            <div class="stat-value negative">{{ result.loss_trades }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">胜率</div>
            <div class="stat-value" :class="result.win_rate >= 50 ? 'positive' : 'negative'">
              {{ result.win_rate?.toFixed(2) }}%
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 资金变化 -->
      <div class="chart-section">
        <div class="section-title">资金曲线</div>
        <div class="equity-curve">
          <div v-for="(point, idx) in result.equity_curve" :key="idx" 
               class="curve-point" 
               :style="{left: idx / (result.equity_curve.length - 1) * 100 + '%', bottom: ((point.value - minEquity) / (maxEquity - minEquity) * 100) + '%'}"
               :title="point.date + ': ' + point.value">
          </div>
          <div class="curve-line" :style="{background: result.total_return >= 0 ? '#67c23a' : '#f56c6c'}"></div>
        </div>
        <div class="curve-labels">
          <span>{{ result.start_date }}</span>
          <span>初始: {{ result.initial_capital }}</span>
          <span>最终: {{ result.final_capital?.toFixed(0) }}</span>
          <span>{{ result.end_date }}</span>
        </div>
      </div>

      <!-- 交易记录 -->
      <div class="trades-section">
        <div class="section-title">交易记录</div>
        <el-table :data="result.trades_json" stripe max-height="300">
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column prop="type" label="操作" width="80">
            <template #default="{ row }">
              <el-tag :type="row.type === 'buy' ? 'primary' : 'success'" size="small">
                {{ row.type === 'buy' ? '买入' : '卖出' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="price" label="价格" width="100">
            <template #default="{ row }">{{ row.price?.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="shares" label="数量" width="100" />
          <el-table-column prop="amount" label="金额" width="120">
            <template #default="{ row }">{{ row.amount?.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="profit" label="收益" width="100">
            <template #default="{ row }">
              <span v-if="row.profit !== undefined" :class="row.profit >= 0 ? 'positive' : 'negative'">
                {{ row.profit?.toFixed(2) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 历史回测记录 -->
    <el-card shadow="hover" style="margin-top:16px">
      <template #header>
        <span>历史回测记录</span>
      </template>
      <el-table :data="historyResults" v-loading="historyLoading" stripe>
        <el-table-column prop="stock_name" label="股票" width="120">
          <template #default="{ row }">{{ row.stock_name }} ({{ row.stock_code }})</template>
        </el-table-column>
        <el-table-column prop="start_date" label="开始日期" width="120" />
        <el-table-column prop="end_date" label="结束日期" width="120" />
        <el-table-column prop="total_return" label="收益率" width="100">
          <template #default="{ row }">
            <span :class="row.total_return >= 0 ? 'positive' : 'negative'">{{ row.total_return?.toFixed(2) }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="max_drawdown" label="最大回撤" width="100">
          <template #default="{ row }">{{ row.max_drawdown?.toFixed(2) }}%</template>
        </el-table-column>
        <el-table-column prop="total_trades" label="交易次数" width="100" />
        <el-table-column prop="win_rate" label="胜率" width="80">
          <template #default="{ row }">{{ row.win_rate?.toFixed(0) }}%</template>
        </el-table-column>
        <el-table-column prop="created_at" label="回测时间" width="180">
          <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" @click="viewResult(row)">查看</el-button>
            <el-button size="small" type="danger" @click="deleteResult(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 选择股票对话框 -->
    <el-dialog v-model="stockDialogVisible" title="选择回测股票" width="500px">
      <el-tip type="info" style="margin-bottom:12px">请从LLM选股中正常状态的股票选择</el-tip>
      <el-table :data="stockList" v-loading="stockLoading" @row-click="selectStock" stripe :height="300" style="cursor:pointer">
        <el-table-column prop="stock_code" label="代码" width="100" />
        <el-table-column prop="stock_name" label="名称" width="120" />
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button type="primary" size="small">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { backtestApi } from '@/api'

// 表单数据
const form = ref({
  stock_code: '',
  stock_name: '',
  start_date: '',
  end_date: '',
  initial_capital: 100000,
  ma_short: 5,
  ma_long: 20,
  stop_loss_pct: 0.05,
  take_profit_pct: 0.15,
  config_name: ''
})
const strategyPreset = ref('')
const selectedConfigId = ref(null)

// 状态
const running = ref(false)
const savingConfig = ref(false)
const stockDialogVisible = ref(false)
const stockLoading = ref(false)
const stockList = ref([])
const configList = ref([])
const historyResults = ref([])
const historyLoading = ref(false)

// 回测结果
const result = ref(null)

// 计算权益曲线范围
const minEquity = computed(() => Math.min(...(result.value?.equity_curve?.map(p => p.value) || [0])))
const maxEquity = computed(() => Math.max(...(result.value?.equity_curve?.map(p => p.value) || [1])))

// 策略预设
const applyStrategy = (val) => {
  if (val === 'ma_5_20') {
    form.value.ma_short = 5
    form.value.ma_long = 20
  } else if (val === 'ma_10_30') {
    form.value.ma_short = 10
    form.value.ma_long = 30
  } else if (val === 'ma_20_60') {
    form.value.ma_short = 20
    form.value.ma_long = 60
  }
}

// 选择股票
const openStockDialog = async () => {
  stockDialogVisible.value = true
  stockLoading.value = true
  try {
    const res = await backtestApi.getStocks()
    stockList.value = res?.data || []
  } finally {
    stockLoading.value = false
  }
}

const selectStock = (row) => {
  form.value.stock_code = row.stock_code
  form.value.stock_name = row.stock_name
  stockDialogVisible.value = false
  ElMessage.success(`已选择 ${row.stock_name}`)
}

// 加载配置
const loadConfigs = async () => {
  const res = await backtestApi.getConfigs()
  configList.value = res?.data || []
}

const loadConfig = async (id) => {
  if (!id) return
  const config = configList.value.find(c => c.id === id)
  if (config) {
    form.value.stock_code = config.stock_code
    form.value.stock_name = config.stock_name
    form.value.start_date = config.start_date
    form.value.end_date = config.end_date
    form.value.initial_capital = config.initial_capital
    form.value.ma_short = config.params?.ma_short || 5
    form.value.ma_long = config.params?.ma_long || 20
    form.value.stop_loss_pct = config.params?.stop_loss_pct || 0.05
    form.value.take_profit_pct = config.params?.take_profit_pct || 0.15
    form.value.config_name = config.name
    ElMessage.success('配置已加载')
  }
}

// 保存配置
const saveConfig = async () => {
  if (!form.value.config_name) {
    ElMessage.warning('请输入配置名称')
    return
  }
  if (!form.value.stock_code) {
    ElMessage.warning('请先选择股票')
    return
  }
  savingConfig.value = true
  try {
    await backtestApi.createConfig({
      name: form.value.config_name,
      stock_code: form.value.stock_code,
      stock_name: form.value.stock_name,
      start_date: form.value.start_date,
      end_date: form.value.end_date,
      initial_capital: form.value.initial_capital,
      buy_strategy: `MA${form.value.ma_short}/${form.value.ma_long}金叉`,
      sell_strategy: `MA${form.value.ma_short}/${form.value.ma_long}死叉或止盈止损`,
      params: {
        ma_short: form.value.ma_short,
        ma_long: form.value.ma_long,
        stop_loss_pct: form.value.stop_loss_pct,
        take_profit_pct: form.value.take_profit_pct
      }
    })
    ElMessage.success('配置已保存')
    loadConfigs()
  } finally {
    savingConfig.value = false
  }
}

// 执行回测
const runBacktest = async () => {
  running.value = true
  try {
    const res = await backtestApi.run({
      stock_code: form.value.stock_code,
      stock_name: form.value.stock_name,
      start_date: form.value.start_date,
      end_date: form.value.end_date,
      initial_capital: form.value.initial_capital,
      ma_short: form.value.ma_short,
      ma_long: form.value.ma_long,
      stop_loss_pct: form.value.stop_loss_pct,
      take_profit_pct: form.value.take_profit_pct
    })
    if (res.code === 0) {
      result.value = res.data
      ElMessage.success('回测完成')
      loadHistory()
    } else {
      ElMessage.error(res.message || '回测失败')
    }
  } catch (e) {
    ElMessage.error('回测失败: ' + (e.message || '未知错误'))
  } finally {
    running.value = false
  }
}

// 查看历史结果
const loadHistory = async () => {
  historyLoading.value = true
  try {
    const res = await backtestApi.getResults({})
    historyResults.value = res?.data || []
  } finally {
    historyLoading.value = false
  }
}

const viewResult = async (row) => {
  const res = await backtestApi.getResult(row.id)
  if (res.code === 0) {
    result.value = res.data
  }
}

const deleteResult = async (row) => {
  await ElMessageBox.confirm('确认删除此回测记录？', '提示', { type: 'warning' })
  await backtestApi.deleteResult(row.id)
  ElMessage.success('已删除')
  loadHistory()
}

// 重置参数
const resetForm = () => {
  form.value.start_date = ''
  form.value.end_date = ''
  form.value.initial_capital = 100000
  form.value.ma_short = 5
  form.value.ma_long = 20
  form.value.stop_loss_pct = 0.05
  form.value.take_profit_pct = 0.15
  form.value.config_name = ''
  strategyPreset.value = ''
  selectedConfigId.value = null
}

// 默认日期范围
const initDates = () => {
  const now = new Date()
  const oneYearAgo = new Date(now)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  form.value.end_date = now.toISOString().slice(0, 10)
  form.value.start_date = oneYearAgo.toISOString().slice(0, 10)
}

onMounted(() => {
  initDates()
  loadConfigs()
  loadHistory()
})
</script>

<style scoped>
.selected-stock {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tip-text {
  color: #909399;
  font-size: 14px;
}
.result-stats {
  margin-bottom: 20px;
}
.stat-item {
  text-align: center;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
}
.positive { color: #67c23a; }
.negative { color: #f56c6c; }

.chart-section, .trades-section {
  margin-top: 20px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #303133;
}

.equity-curve {
  position: relative;
  height: 150px;
  background: linear-gradient(to bottom, #f0f2f5, #fff);
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
.curve-point {
  position: absolute;
  width: 2px;
  height: 2px;
  background: #409eff;
  transform: translateX(-50%);
}
.curve-line {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  opacity: 0.3;
}
.curve-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
</style>