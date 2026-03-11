<template>
  <div>
    <el-card shadow="hover" class="mb-4">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>LLM选股记录</span>
          <el-button type="primary" @click="addDialogVisible = true">新增预测</el-button>
        </div>
      </template>
      <el-tabs v-model="activeTab" @tab-change="loadList">
        <el-tab-pane label="全部" name="" />
        <el-tab-pane label="进行中" name="active" />
        <el-tab-pane label="成功" name="success" />
        <el-tab-pane label="失败" name="failed" />
        <el-tab-pane label="已放弃" name="abandoned" />
      </el-tabs>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="stock_code" label="代码" width="90" />
        <el-table-column prop="stock_name" label="名称" width="100" />
        <el-table-column prop="prediction_date" label="预测日期" width="110" />
        <el-table-column prop="target_price" label="目标价" width="90" />
        <el-table-column prop="stop_loss" label="止损价" width="90" />
        <el-table-column prop="confidence" label="置信度" width="90">
          <template #default="{ row }">{{ (row.confidence * 100).toFixed(0) }}%</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="理由" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button v-if="row.status === 'active'" size="small" type="danger" @click="abandon(row)">放弃</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination class="mt-4" :total="total" :page-size="pageSize" :current-page="page" @current-change="onPageChange" layout="total, prev, pager, next" />
    </el-card>

    <el-dialog v-model="addDialogVisible" title="新增预测" width="500px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="股票代码"><el-input v-model="form.stock_code" /></el-form-item>
        <el-form-item label="股票名称"><el-input v-model="form.stock_name" /></el-form-item>
        <el-form-item label="目标价"><el-input-number v-model="form.target_price" :precision="2" /></el-form-item>
        <el-form-item label="止损价"><el-input-number v-model="form.stop_loss" :precision="2" /></el-form-item>
        <el-form-item label="置信度"><el-slider v-model="form.confidence" :min="0" :max="1" :step="0.01" show-input /></el-form-item>
        <el-form-item label="LLM模型"><el-input v-model="form.llm_model" /></el-form-item>
        <el-form-item label="理由"><el-input v-model="form.reason" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAdd" :loading="submitting">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { predictionApi } from '@/api'

const list = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const activeTab = ref('')
const addDialogVisible = ref(false)
const submitting = ref(false)
const form = ref({ stock_code: '', stock_name: '', target_price: 0, stop_loss: 0, confidence: 0.7, llm_model: 'gpt-4', reason: '' })

const statusType = (s) => ({ active: 'primary', success: 'success', failed: 'danger', abandoned: 'info' }[s] || 'info')
const statusLabel = (s) => ({ active: '进行中', success: '成功', failed: '失败', abandoned: '已放弃' }[s] || s)

const loadList = async () => {
  loading.value = true
  try {
    const res = await predictionApi.getList({ status: activeTab.value, page: page.value, pageSize: pageSize.value })
    list.value = res?.data?.list || []
    total.value = res?.data?.total || 0
  } finally {
    loading.value = false
  }
}

const abandon = async (row) => {
  await ElMessageBox.confirm(`确认放弃 ${row.stock_name} 的预测？`, '提示', { type: 'warning' })
  await predictionApi.abandon(row.id)
  ElMessage.success('已放弃')
  loadList()
}

const submitAdd = async () => {
  submitting.value = true
  try {
    await predictionApi.generate(form.value)
    ElMessage.success('添加成功')
    addDialogVisible.value = false
    loadList()
  } finally {
    submitting.value = false
  }
}

const onPageChange = (p) => { page.value = p; loadList() }
onMounted(loadList)
</script>

<style scoped>
.mb-4 { margin-bottom: 16px; }
.mt-4 { margin-top: 16px; }
</style>
