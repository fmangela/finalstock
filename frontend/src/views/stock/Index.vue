<template>
  <div>
    <el-row :gutter="16" class="mb-4">
      <el-col :span="8" v-for="idx in indices" :key="idx.code">
        <el-card shadow="hover">
          <div class="index-card">
            <div class="index-name">{{ idx.name }}</div>
            <div class="index-price" :class="idx.change_pct >= 0 ? 'up' : 'down'">{{ idx.price?.toFixed(2) }}</div>
            <div class="index-change" :class="idx.change_pct >= 0 ? 'up' : 'down'">
              {{ idx.change_pct >= 0 ? '+' : '' }}{{ idx.change_pct?.toFixed(2) }}%
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>A股列表</span>
          <el-input v-model="keyword" placeholder="搜索股票" style="width:200px" @input="onSearch" clearable />
        </div>
      </template>
      <el-table :data="stocks" v-loading="loading" stripe>
        <el-table-column prop="code" label="代码" width="90" />
        <el-table-column prop="name" label="名称" width="100" />
        <el-table-column prop="price" label="最新价" width="90">
          <template #default="{ row }">
            <span :class="row.change_pct >= 0 ? 'up' : 'down'">{{ row.price }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="change_pct" label="涨跌幅" width="90">
          <template #default="{ row }">
            <span :class="row.change_pct >= 0 ? 'up' : 'down'">
              {{ row.change_pct >= 0 ? '+' : '' }}{{ row.change_pct?.toFixed(2) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="turnover_rate" label="换手率" width="90">
          <template #default="{ row }">{{ row.turnover_rate?.toFixed(2) }}%</template>
        </el-table-column>
        <el-table-column prop="pe" label="PE" width="80" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="mt-4"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="onPageChange"
        layout="total, prev, pager, next"
      />
    </el-card>

    <el-dialog v-model="detailVisible" :title="selectedStock?.name" width="800px">
      <div v-if="klineData.length">
        <v-chart :option="klineOption" style="height:400px" autoresize />
      </div>
      <el-empty v-else description="暂无K线数据" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { use } from 'echarts/core'
import { CandlestickChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { stockApi } from '@/api'

use([CandlestickChart, LineChart, GridComponent, TooltipComponent, DataZoomComponent, CanvasRenderer])

const stocks = ref([])
const indices = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const keyword = ref('')
const detailVisible = ref(false)
const selectedStock = ref(null)
const klineData = ref([])
let searchTimer = null

const klineOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
  xAxis: { type: 'category', data: klineData.value.map(d => d.date) },
  yAxis: { type: 'value', scale: true },
  dataZoom: [{ type: 'inside', start: 60, end: 100 }],
  series: [{
    type: 'candlestick',
    data: klineData.value.map(d => [d.open, d.close, d.low, d.high]),
    itemStyle: { color: '#f56c6c', color0: '#67c23a', borderColor: '#f56c6c', borderColor0: '#67c23a' }
  }]
}))

const loadStocks = async () => {
  loading.value = true
  try {
    const res = await stockApi.getList({ page: page.value, pageSize: pageSize.value, keyword: keyword.value })
    stocks.value = res?.data?.list || []
    total.value = res?.data?.total || 0
  } finally {
    loading.value = false
  }
}

const onSearch = () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadStocks() }, 500)
}

const onPageChange = (p) => { page.value = p; loadStocks() }

const viewDetail = async (stock) => {
  selectedStock.value = stock
  detailVisible.value = true
  const res = await stockApi.getHistory(stock.code, { period: 'daily', limit: 120 })
  klineData.value = res?.data || []
}

onMounted(async () => {
  const [mkt] = await Promise.allSettled([stockApi.getMarketOverview()])
  if (mkt.status === 'fulfilled') indices.value = mkt.value?.data || []
  loadStocks()
})
</script>

<style scoped>
.mb-4 { margin-bottom: 16px; }
.mt-4 { margin-top: 16px; }
.up { color: #f56c6c; }
.down { color: #67c23a; }
.index-card { text-align: center; padding: 8px 0; }
.index-name { font-size: 14px; color: #666; margin-bottom: 8px; }
.index-price { font-size: 24px; font-weight: bold; }
.index-change { font-size: 14px; margin-top: 4px; }
</style>
