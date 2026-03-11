<template>
  <div>
    <el-row :gutter="16" class="mb-4">
      <el-col :span="8" v-for="idx in indices" :key="idx.code">
        <el-card shadow="hover">
          <div class="index-card">
            <div class="index-name">{{ idx.name }}</div>
            <div class="index-price" :class="idx.change_pct >= 0 ? 'up' : 'down'">
              {{ idx.price?.toFixed(2) }}
            </div>
            <div class="index-change" :class="idx.change_pct >= 0 ? 'up' : 'down'">
              {{ idx.change_pct >= 0 ? '+' : '' }}{{ idx.change_pct?.toFixed(2) }}%
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card title="今日指引" shadow="hover">
          <template #header><span>今日操作指引</span></template>
          <div v-if="guidance">
            <el-tag :type="riskTagType(guidance.risk_level)" class="mb-2">
              风险等级: {{ guidance.risk_level }}/5
            </el-tag>
            <p>{{ guidance.guidance || '暂无指引' }}</p>
          </div>
          <el-empty v-else description="暂无今日指引" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header><span>模拟账户</span></template>
          <div v-if="account">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="初始资金">{{ formatMoney(account.initial_capital) }}</el-descriptions-item>
              <el-descriptions-item label="当前资金">{{ formatMoney(account.current_capital) }}</el-descriptions-item>
              <el-descriptions-item label="总盈亏">
                <span :class="+account.total_profit_loss >= 0 ? 'up' : 'down'">
                  {{ formatMoney(account.total_profit_loss) }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="胜率">
                {{ account.total_trades > 0 ? ((account.win_trades / account.total_trades) * 100).toFixed(1) : 0 }}%
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { stockApi, analysisApi, simulationApi } from '@/api'

const indices = ref([])
const guidance = ref(null)
const account = ref(null)

const riskTagType = (level) => {
  if (level <= 2) return 'success'
  if (level <= 3) return 'warning'
  return 'danger'
}

const formatMoney = (val) => {
  if (!val) return '¥0.00'
  return '¥' + Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

onMounted(async () => {
  const [mkt, g, acc] = await Promise.allSettled([
    stockApi.getMarketOverview(),
    analysisApi.getToday(),
    simulationApi.getAccount()
  ])
  if (mkt.status === 'fulfilled') indices.value = mkt.value?.data || []
  if (g.status === 'fulfilled') guidance.value = g.value?.data
  if (acc.status === 'fulfilled') account.value = acc.value?.data
})
</script>

<style scoped>
.mb-4 { margin-bottom: 16px; }
.mb-2 { margin-bottom: 8px; }
.index-card { text-align: center; padding: 8px 0; }
.index-name { font-size: 14px; color: #666; margin-bottom: 8px; }
.index-price { font-size: 24px; font-weight: bold; }
.index-change { font-size: 14px; margin-top: 4px; }
.up { color: #f56c6c; }
.down { color: #67c23a; }
</style>
