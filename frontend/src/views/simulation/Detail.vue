<template>
  <div v-loading="loading">
    <div style="margin-bottom:16px">
      <el-button @click="$router.back()">← 返回列表</el-button>
      <el-button type="primary" @click="manualRun" :loading="running" style="margin-left:8px"
        v-if="task && task.status === 'running'">手动推进</el-button>
    </div>

    <template v-if="task">
      <!-- 基础信息 -->
      <el-card shadow="hover" class="mb-4">
        <template #header>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span>{{ task.stock_name }} ({{ task.stock_code }}) — {{ task.strategy_type.toUpperCase() }} 策略</span>
            <el-tag :type="statusType(task.status)">{{ statusLabel(task.status) }}</el-tag>
          </div>
        </template>
        <el-row :gutter="20">
          <el-col :span="4">
            <div class="info-item">
              <div class="info-label">初始资金</div>
              <div class="info-value">{{ formatMoney(task.initial_capital) }}</div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="info-item">
              <div class="info-label">现金余额</div>
              <div class="info-value">{{ formatMoney(task.cash_balance) }}</div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="info-item">
              <div class="info-label">持股 / 均价</div>
              <div class="info-value">{{ task.shares > 0 ? task.shares + '股 @' + task.avg_cost : '-' }}</div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="info-item">
              <div class="info-label">浮动盈亏</div>
              <div class="info-value" :class="floatPL >= 0 ? 'up' : 'down'">
                {{ task.shares > 0 ? formatMoney(floatPL) : '-' }}
              </div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="info-item">
              <div class="info-label">总收益率</div>
              <div class="info-value" :class="Number(task.total_return) >= 0 ? 'up' : 'down'">
                {{ Number(task.total_return || 0).toFixed(2) }}%
              </div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="info-item">
              <div class="info-label">最大回撤</div>
              <div class="info-value down">{{ Number(task.max_drawdown || 0).toFixed(2) }}%</div>
            </div>
          </el-col>
        </el-row>
        <el-row :gutter="20" style="margin-top:12px">
          <el-col :span="4">
            <div class="info-item">
              <div class="info-label">胜率</div>
              <div class="info-value">
                {{ task.total_trades > 0 ? ((task.win_trades / task.total_trades) * 100).toFixed(1) : '-' }}%
                ({{ task.win_trades }}/{{ task.total_trades }})
              </div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="info-item">
              <div class="info-label">最近执行</div>
              <div class="info-value">{{ task.last_run_date || '-' }}</div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="info-item">
              <div class="info-label">交易时机</div>
              <div class="info-value">{{ task.trade_timing === 'pre_open' ? '盘前(9:25)' : '收盘前(14:55)' }}</div>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <!-- K线图 -->
      <el-card shadow="hover" class="mb-4" v-if="klineData.length > 0">
        <template #header>K线图（含买卖点）</template>
        <v-chart :option="klineOption" style="height:400px" autoresize />
      </el-card>

      <!-- 资金曲线 -->
      <el-card shadow="hover" class="mb-4" v-if="equityCurve.length > 0">
        <template #header>资金曲线</template>
        <v-chart :option="equityOption" style="height:240px" autoresize />
      </el-card>

      <!-- 交易记录 -->
      <el-card shadow="hover">
        <template #header>交易记录（共 {{ trades.length }} 条）</template>
        <el-table :data="trades" stripe size="small">
          <el-table-column prop="trade_date" label="日期" width="110" />
          <el-table-column label="类型" width="70">
            <template #default="{ row }">
              <el-tag :type="row.type === 'buy' ? 'danger' : 'success'" size="small">
                {{ row.type === 'buy' ? '买入' : '卖出' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="price" label="成交价" width="90" />
          <el-table-column prop="shares" label="股数" width="80" />
          <el-table-column label="金额" width="110">
            <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="盈亏" width="110">
            <template #default="{ row }">
              <span v-if="row.type === 'sell'" :class="Number(row.profit_loss) >= 0 ? 'up' : 'down'">
                {{ formatMoney(row.profit_loss) }}
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="持仓天数" width="90">
            <template #default="{ row }">{{ row.type === 'sell' ? row.hold_days + '天' : '-' }}</template>
          </el-table-column>
          <el-table-column prop="signal_reason" label="信号" />
          <el-table-column label="涨跌停" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.is_limit_up" type="danger" size="small">涨停</el-tag>
              <el-tag v-else-if="row.is_limit_down" type="success" size="small">跌停</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { CandlestickChart, LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkPointComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { simApi } from '@/api'

use([CanvasRenderer, CandlestickChart, LineChart, ScatterChart,
  GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkPointComponent])

const route = useRoute()
const loading = ref(false)
const running = ref(false)
const task = ref(null)
const trades = ref([])
const equityCurve = ref([])
const klineData = ref([])
const currentPrice = ref(0)
const floatPL = ref(0)

const statusType = (s) => ({ running: 'success', paused: 'warning', stopped: 'info' }[s] || 'info')
const statusLabel = (s) => ({ running: '运行中', paused: '已暂停', stopped: '已停止' }[s] || s)

const formatMoney = (val) => {
  if (val === null || val === undefined) return '-'
  const n = Number(val)
  return (n >= 0 ? '¥' : '-¥') + Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

const loadDetail = async () => {
  loading.value = true
  try {
    const res = await simApi.getTask(route.params.id)
    const d = res?.data
    if (!d) return
    task.value = d.task
    trades.value = d.trades || []
    equityCurve.value = d.equityCurve || []
    klineData.value = d.klineData || []
    currentPrice.value = d.currentPrice || 0
    floatPL.value = d.floatPL || 0
  } finally {
    loading.value = false
  }
}

const manualRun = async () => {
  running.value = true
  try {
    const res = await simApi.runTask(route.params.id)
    ElMessage.success(`推进完成: ${res?.data?.action || 'ok'}`)
    await loadDetail()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '推进失败')
  } finally {
    running.value = false
  }
}

// K线图配置
const klineOption = computed(() => {
  if (!klineData.value.length) return {}
  const dates = klineData.value.map(k => k.date)
  const ohlc  = klineData.value.map(k => [k.open, k.close, k.low, k.high])

  // 买卖点
  const buyPoints  = trades.value.filter(t => t.type === 'buy').map(t => ({ coord: [t.trade_date, t.price], value: 'B', itemStyle: { color: '#f56c6c' } }))
  const sellPoints = trades.value.filter(t => t.type === 'sell').map(t => ({ coord: [t.trade_date, t.price], value: 'S', itemStyle: { color: '#67c23a' } }))

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['K线'] },
    grid: { left: 60, right: 20, top: 40, bottom: 60 },
    xAxis: { type: 'category', data: dates, scale: true },
    yAxis: { type: 'value', scale: true },
    dataZoom: [{ type: 'inside', start: 60, end: 100 }, { type: 'slider', start: 60, end: 100 }],
    series: [{
      name: 'K线', type: 'candlestick', data: ohlc,
      itemStyle: { color: '#f56c6c', color0: '#67c23a', borderColor: '#f56c6c', borderColor0: '#67c23a' },
      markPoint: {
        symbol: 'circle', symbolSize: 20,
        data: [...buyPoints, ...sellPoints],
        label: { color: '#fff', fontSize: 10 }
      }
    }]
  }
})

// 资金曲线配置
const equityOption = computed(() => {
  if (!equityCurve.value.length) return {}
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: equityCurve.value.map(p => p.date) },
    yAxis: { type: 'value', scale: true },
    series: [{
      type: 'line', data: equityCurve.value.map(p => p.value),
      smooth: true, areaStyle: { opacity: 0.1 },
      lineStyle: { color: '#409eff' }, itemStyle: { color: '#409eff' }
    }]
  }
})

onMounted(loadDetail)
</script>

<style scoped>
.mb-4 { margin-bottom: 16px; }
.info-item { text-align: center; }
.info-label { color: #909399; font-size: 12px; margin-bottom: 4px; }
.info-value { font-size: 15px; font-weight: 500; }
.up { color: #f56c6c; }
.down { color: #67c23a; }
</style>
