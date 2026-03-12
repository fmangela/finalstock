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

      <!-- K线图表 -->
      <div v-if="result.kline_data && result.kline_data.length > 0" class="chart-section">
        <div class="section-title">股票走势与买卖点</div>
        <div ref="chartRef" style="width: 100%; height: 400px;"></div>
      </div>

      <!-- 核心指标 -->
      <el-row :gutter="20" class="result-stats">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">总收益率</div>
            <div class="stat-value" :class="Number(result.total_return) >= 0 ? 'positive' : 'negative'">
              {{ Number(result.total_return).toFixed(2) }}%
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">年化收益率</div>
            <div class="stat-value" :class="result.annual_return >= 0 ? 'positive' : 'negative'">
              {{ Number(result.annual_return || 0).toFixed(2) }}%
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">最大回撤</div>
            <div class="stat-value negative">{{ Number(result.max_drawdown).toFixed(2) }}%</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">夏普比率</div>
            <div class="stat-value">{{ Number(result.sharpe_ratio || 0).toFixed(2) }}</div>
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
            <div class="stat-value" :class="Number(result.win_rate) >= 50 ? 'positive' : 'negative'">
              {{ Number(result.win_rate).toFixed(2) }}%
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 资金变化 -->
      <div class="chart-section">
        <div class="section-title">资金曲线</div>
        <div class="equity-curve">
          <div v-for="(point, idx) in getEquityCurve()" :key="idx" 
               class="curve-point" 
               :style="{left: idx / (getEquityCurve().length - 1 || 1) * 100 + '%', bottom: ((point.value - minEquity) / ((maxEquity - minEquity) || 1) * 100) + '%'}"
               :title="point.date + ': ' + point.value">
          </div>
          <div class="curve-line" :style="{background: Number(result.total_return) >= 0 ? '#67c23a' : '#f56c6c'}"></div>
        </div>
        <div class="curve-labels">
          <span>{{ result.start_date }}</span>
          <span>初始: {{ result.initial_capital }}</span>
          <span>最终: {{ Number(result.final_capital || 0).toFixed(0) }}</span>
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
            <template #default="{ row }">{{ Number(row.price || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="shares" label="数量" width="100" />
          <el-table-column prop="amount" label="金额" width="120">
            <template #default="{ row }">{{ Number(row.amount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="profit" label="收益" width="100">
            <template #default="{ row }">
              <span v-if="row.profit !== undefined" :class="row.profit >= 0 ? 'positive' : 'negative'">
                {{ Number(row.profit || 0).toFixed(2) }}
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
            <span :class="Number(row.total_return || 0) >= 0 ? 'positive' : 'negative'">{{ Number(row.total_return || 0).toFixed(2) }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="max_drawdown" label="最大回撤" width="100">
          <template #default="{ row }">{{ Number(row.max_drawdown || 0).toFixed(2) }}%</template>
        </el-table-column>
        <el-table-column prop="total_trades" label="交易次数" width="100" />
        <el-table-column prop="win_rate" label="胜率" width="80">
          <template #default="{ row }">{{ Number(row.win_rate || 0).toFixed(0) }}%</template>
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
      <el-alert type="info" :closable="false" style="margin-bottom:12px">请从LLM选股中正常状态的股票选择</el-alert>
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
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import { backtestApi } from '@/api'

// 图表引用
const chartRef = ref(null)
let chartInstance = null

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
const getEquityCurve = () => {
  const curve = result.value?.equity_curve
  if (!curve || !Array.isArray(curve)) return []
  return curve
}
const minEquity = computed(() => {
  const curve = getEquityCurve()
  if (curve.length === 0) return 0
  return Math.min(...curve.map(p => p.value))
})
const maxEquity = computed(() => {
  const curve = getEquityCurve()
  if (curve.length === 0) return 1
  return Math.max(...curve.map(p => p.value))
})

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
  } catch (e) {
    console.error('获取股票列表失败:', e)
    stockList.value = []
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
  try {
    const res = await backtestApi.getConfigs()
    configList.value = res?.data || []
  } catch (e) {
    console.error('加载配置失败:', e)
    configList.value = []
  }
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
      // 绑制图表
      if (res.data.kline_data && res.data.kline_data.length > 0) {
        setTimeout(renderChart, 100)
      }
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
  } catch (e) {
    console.error('加载历史记录失败:', e)
    historyResults.value = []
  } finally {
    historyLoading.value = false
  }
}

const viewResult = async (row) => {
  try {
    const res = await backtestApi.getResult(row.id)
    if (res.code === 0) {
      const data = res.data
      // 解析JSON字符串字段
      if (typeof data.equity_curve === 'string') {
        data.equity_curve = JSON.parse(data.equity_curve)
      }
      if (typeof data.trades_json === 'string') {
        data.trades_json = JSON.parse(data.trades_json)
      }
      if (typeof data.monthly_returns === 'string') {
        data.monthly_returns = JSON.parse(data.monthly_returns)
      }
      if (typeof data.kline_data === 'string') {
        data.kline_data = JSON.parse(data.kline_data)
      }
      if (typeof data.buy_points === 'string') {
        data.buy_points = JSON.parse(data.buy_points)
      }
      if (typeof data.sell_points === 'string') {
        data.sell_points = JSON.parse(data.sell_points)
      }
      if (typeof data.ma5 === 'string') {
        data.ma5 = JSON.parse(data.ma5)
      }
      if (typeof data.ma20 === 'string') {
        data.ma20 = JSON.parse(data.ma20)
      }
      result.value = data
      // 如果有K线数据则绑制图表
      if (data.kline_data && data.kline_data.length > 0) {
        setTimeout(renderChart, 100)
      }
    }
  } catch (e) {
    console.error('加载回测结果失败:', e)
    ElMessage.error('加载回测结果失败')
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

// 绑制K线图表
const renderChart = async () => {
  if (!result.value || !result.value.kline_data || result.value.kline_data.length === 0) {
    return
  }

  await nextTick()
  
  if (!chartRef.value) return
  
  // 初始化或更新图表
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  const klineData = result.value.kline_data
  const ma5 = result.value.ma5 || []
  const ma20 = result.value.ma20 || []
  const buyPoints = result.value.buy_points || []
  const sellPoints = result.value.sell_points || []

  // 准备K线数据 [open, close, low, high]
  const ohlcData = klineData.map(k => [k.open, k.close, k.low, k.high])
  const dates = klineData.map(k => k.date)

  // 构建买卖点标记数据
  const buyMarkPoints = buyPoints.map(b => {
    const idx = dates.indexOf(b.date)
    return { value: b.price, xAxis: idx, yAxis: b.price }
  })
  const sellMarkPoints = sellPoints.map(s => {
    const idx = dates.indexOf(s.date)
    return { value: s.price, xAxis: idx, yAxis: s.price }
  })

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['K线', 'MA5', 'MA20']
    },
    grid: [
      { left: '10%', right: '10%', height: '50%' },
      { left: '10%', right: '10%', top: '70%', height: '20%' }
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        scale: true,
        boundaryGap: false
      },
      {
        type: 'category',
        gridIndex: 1,
        data: dates,
        scale: true,
        boundaryGap: false,
        axisLabel: { show: false }
      }
    ],
    yAxis: [
      {
        scale: true,
        splitArea: { show: true }
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false }
      }
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 50, end: 100 },
      { show: true, xAxisIndex: [0, 1], type: 'slider', top: '95%', start: 50, end: 100 }
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: ohlcData,
        itemStyle: {
          color: '#ef232a',
          color0: '#14b143',
          borderColor: '#ef232a',
          borderColor0: '#14b143'
        }
      },
      {
        name: 'MA5',
        type: 'line',
        data: ma5.slice(-klineData.length),
        smooth: true,
        lineStyle: { opacity: 0.5 },
        symbol: 'none'
      },
      {
        name: 'MA20',
        type: 'line',
        data: ma20.slice(-klineData.length),
        smooth: true,
        lineStyle: { opacity: 0.5 },
        symbol: 'none'
      },
      {
        name: '买入点',
        type: 'scatter',
        symbol: 'triangle',
        symbolSize: 15,
        itemStyle: { color: '#ff6b6b' },
        data: buyMarkPoints,
        markPoint: {
          data: buyMarkPoints.map(p => ({
            coord: [p.xAxis, p.yAxis],
            value: '买',
            itemStyle: { color: '#67c23a' }
          }))
        }
      },
      {
        name: '卖出点',
        type: 'scatter',
        symbol: 'triangle',
        symbolSize: 15,
        symbolRotate: 180,
        itemStyle: { color: '#67c23a' },
        data: sellMarkPoints,
        markPoint: {
          data: sellMarkPoints.map((p, idx) => ({
            coord: [p.xAxis, p.yAxis],
            value: p.profit > 0 ? '卖+' : '卖-',
            itemStyle: { color: p.profit > 0 ? '#f56c6c' : '#67c23a' }
          }))
        }
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: klineData.map(k => k.volume)
      }
    ]
  }

  chartInstance.setOption(option)
}

onMounted(() => {
  initDates()
  loadConfigs()
  loadHistory()
  // 窗口大小变化时调整图表
  window.addEventListener('resize', () => {
    if (chartInstance) {
      chartInstance.resize()
    }
  })
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