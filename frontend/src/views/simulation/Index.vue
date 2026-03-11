<template>
  <div>
    <el-row :gutter="16" class="mb-4">
      <el-col :span="24">
        <el-card shadow="hover">
          <template #header><span>模拟账户</span></template>
          <el-descriptions :column="4" border v-if="account">
            <el-descriptions-item label="初始资金">{{ formatMoney(account.initial_capital) }}</el-descriptions-item>
            <el-descriptions-item label="当前资金">{{ formatMoney(account.current_capital) }}</el-descriptions-item>
            <el-descriptions-item label="总盈亏">
              <span :class="+account.total_profit_loss >= 0 ? 'up' : 'down'">
                {{ formatMoney(account.total_profit_loss) }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="胜率">
              {{ account.total_trades > 0 ? ((account.win_trades / account.total_trades) * 100).toFixed(1) : 0 }}%
              ({{ account.win_trades }}/{{ account.total_trades }})
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>持仓列表</span>
          <el-button type="primary" @click="buyDialogVisible = true">买入</el-button>
        </div>
      </template>
      <el-tabs v-model="posTab" @tab-change="loadPositions">
        <el-tab-pane label="持仓中" name="holding" />
        <el-tab-pane label="已卖出" name="sold" />
        <el-tab-pane label="全部" name="" />
      </el-tabs>
      <el-table :data="positions" v-loading="loading" stripe>
        <el-table-column prop="stock_code" label="代码" width="90" />
        <el-table-column prop="stock_name" label="名称" width="100" />
        <el-table-column prop="buy_date" label="买入日期" width="110" />
        <el-table-column prop="buy_price" label="买入价" width="90" />
        <el-table-column prop="shares" label="股数" width="80" />
        <el-table-column prop="current_price" label="现价" width="90" />
        <el-table-column label="浮动盈亏" width="110">
          <template #default="{ row }">
            <span v-if="row.status === 'holding'" :class="floatPL(row) >= 0 ? 'up' : 'down'">
              {{ formatMoney(floatPL(row)) }}
            </span>
            <span v-else :class="+row.profit_loss >= 0 ? 'up' : 'down'">
              {{ formatMoney(row.profit_loss) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'holding' ? 'primary' : 'info'" size="small">
              {{ row.status === 'holding' ? '持仓中' : '已卖出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button v-if="row.status === 'holding'" size="small" type="danger" @click="openSell(row)">卖出</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 买入对话框 -->
    <el-dialog v-model="buyDialogVisible" title="买入股票" width="400px">
      <el-form :model="buyForm" label-width="80px">
        <el-form-item label="股票代码"><el-input v-model="buyForm.stock_code" /></el-form-item>
        <el-form-item label="股票名称"><el-input v-model="buyForm.stock_name" /></el-form-item>
        <el-form-item label="买入价格"><el-input-number v-model="buyForm.price" :precision="2" :min="0" /></el-form-item>
        <el-form-item label="买入股数"><el-input-number v-model="buyForm.shares" :min="100" :step="100" /></el-form-item>
        <el-form-item label="预计费用">
          <span>{{ formatMoney(buyForm.price * buyForm.shares) }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="buyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitBuy" :loading="submitting">确认买入</el-button>
      </template>
    </el-dialog>

    <!-- 卖出对话框 -->
    <el-dialog v-model="sellDialogVisible" title="卖出股票" width="400px">
      <el-form :model="sellForm" label-width="80px">
        <el-form-item label="股票">{{ sellForm.stock_name }} ({{ sellForm.stock_code }})</el-form-item>
        <el-form-item label="持仓股数">{{ sellForm.shares }}</el-form-item>
        <el-form-item label="买入价">{{ sellForm.buy_price }}</el-form-item>
        <el-form-item label="卖出价格"><el-input-number v-model="sellForm.price" :precision="2" :min="0" /></el-form-item>
        <el-form-item label="预计盈亏">
          <span :class="(sellForm.price - sellForm.buy_price) * sellForm.shares >= 0 ? 'up' : 'down'">
            {{ formatMoney((sellForm.price - sellForm.buy_price) * sellForm.shares) }}
          </span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sellDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="submitSell" :loading="submitting">确认卖出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { simulationApi } from '@/api'

const account = ref(null)
const positions = ref([])
const loading = ref(false)
const posTab = ref('holding')
const buyDialogVisible = ref(false)
const sellDialogVisible = ref(false)
const submitting = ref(false)
const buyForm = ref({ stock_code: '', stock_name: '', price: 0, shares: 100 })
const sellForm = ref({ position_id: null, stock_code: '', stock_name: '', shares: 0, buy_price: 0, price: 0 })

const formatMoney = (val) => {
  if (val === null || val === undefined) return '-'
  return (val >= 0 ? '+¥' : '-¥') + Math.abs(Number(val)).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

const floatPL = (row) => (row.current_price - row.buy_price) * row.shares

const loadAccount = async () => {
  const res = await simulationApi.getAccount()
  account.value = res?.data
}

const loadPositions = async () => {
  loading.value = true
  try {
    const res = await simulationApi.getPositions({ status: posTab.value || undefined })
    positions.value = res?.data || []
  } finally {
    loading.value = false
  }
}

const submitBuy = async () => {
  submitting.value = true
  try {
    await simulationApi.buy(buyForm.value)
    ElMessage.success('买入成功')
    buyDialogVisible.value = false
    buyForm.value = { stock_code: '', stock_name: '', price: 0, shares: 100 }
    await Promise.all([loadAccount(), loadPositions()])
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '买入失败')
  } finally {
    submitting.value = false
  }
}

const openSell = (row) => {
  sellForm.value = { position_id: row.id, stock_code: row.stock_code, stock_name: row.stock_name, shares: row.shares, buy_price: row.buy_price, price: row.current_price || row.buy_price }
  sellDialogVisible.value = true
}

const submitSell = async () => {
  submitting.value = true
  try {
    await simulationApi.sell({ position_id: sellForm.value.position_id, price: sellForm.value.price })
    ElMessage.success('卖出成功')
    sellDialogVisible.value = false
    await Promise.all([loadAccount(), loadPositions()])
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '卖出失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => Promise.all([loadAccount(), loadPositions()]))
</script>

<style scoped>
.mb-4 { margin-bottom: 16px; }
.up { color: #f56c6c; }
.down { color: #67c23a; }
</style>
