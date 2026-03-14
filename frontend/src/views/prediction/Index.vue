<template>
  <div>
    <el-card shadow="hover" class="mb-4">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>LLM选股记录</span>
          <div>
            <el-button type="success" @click="openAiDialog">AI选股</el-button>
            <el-button type="primary" @click="addDialogVisible = true">手动新增</el-button>
          </div>
        </div>
      </template>
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="全部" name="" />
        <el-tab-pane label="进行中" name="active" />
        <el-tab-pane label="成功" name="success" />
        <el-tab-pane label="失败" name="failed" />
        <el-tab-pane label="已放弃" name="abandoned" />
      </el-tabs>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <el-checkbox v-model="selectAll" :indeterminate="isIndeterminate" @change="handleSelectAll">全选</el-checkbox>
        <span v-if="selectedRows.length > 0" style="color:#909399;font-size:13px">已选 {{ selectedRows.length }} 条</span>
        <el-button v-if="activeTab === 'active' || activeTab === ''" size="small" type="warning"
          @click="batchAbandon" :disabled="selectedRows.filter(r=>r.status==='active').length===0">
          批量放弃
        </el-button>
        <el-button v-if="activeTab === 'abandoned' || activeTab === ''" size="small" type="success"
          @click="batchRestore" :disabled="selectedRows.filter(r=>r.status==='abandoned').length===0">
          批量恢复
        </el-button>
        <el-button size="small" type="danger" @click="batchDelete" :disabled="selectedRows.length===0">批量删除</el-button>
      </div>
      <el-table :data="list" v-loading="loading" stripe @selection-change="handleSelectionChange" @sort-change="handleSortChange">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="stock_code" label="代码" width="90" sortable="custom" />
        <el-table-column prop="stock_name" label="名称" width="100" sortable="custom" />
        <el-table-column prop="stockup_date" label="选股时间" width="170" sortable="custom">
          <template #default="{ row }">{{ new Date(row.stockup_date).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column prop="observation_period" label="观测周期" width="90" sortable="custom" />
        <el-table-column prop="prompt_name" label="提示词" width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="llm_model" label="模型" width="120" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="confidence" label="置信度" width="90" sortable="custom">
          <template #default="{ row }">{{ row.confidence != null ? (row.confidence * 100).toFixed(0) + '%' : '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="理由" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button v-if="row.status === 'active'" size="small" type="danger" @click="abandon(row)">放弃</el-button>
            <template v-else-if="row.status === 'abandoned'">
              <el-button size="small" type="success" @click="restore(row)">恢复</el-button>
              <el-button size="small" type="danger" @click="deleteRow(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination class="mt-4" :total="total" :page-size="pageSize" :current-page="page" @current-change="onPageChange" layout="total, prev, pager, next" />
    </el-card>

    <!-- 手动新增对话框 -->
    <el-dialog v-model="addDialogVisible" title="手动新增预测" width="500px">
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

    <!-- AI选股对话框 -->
    <el-dialog v-model="aiDialogVisible" title="AI选股" width="800px" :close-on-click-modal="false">
      <!-- 步骤1：配置 -->
      <template v-if="aiStep === 1">
        <el-form :model="aiForm" label-width="100px">
          <el-form-item label="提示词">
            <el-select v-model="aiForm.prompt_id" placeholder="请选择提示词" style="width:100%">
              <el-option v-for="p in promptList" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="观测周期">
            <el-select v-model="aiForm.observation_period" style="width:200px">
              <el-option label="一周" value="一周" />
              <el-option label="一月" value="一月" />
              <el-option label="一年" value="一年" />
            </el-select>
          </el-form-item>
        </el-form>
        <div v-if="promptList.length === 0" style="color:#999;font-size:13px;margin-top:8px">
          暂无提示词，请先在「设置 → 提示词管理」中添加
        </div>
      </template>

      <!-- 步骤2：结果 -->
      <template v-if="aiStep === 2">
        <div style="margin-bottom:12px">
          <div style="font-weight:600;margin-bottom:6px">大模型原始回复</div>
          <el-input v-model="aiResult.raw_response" type="textarea" :rows="5" readonly />
        </div>
        <div v-if="aiResult.analysis" style="margin-bottom:12px;color:#555;font-size:13px">
          {{ aiResult.analysis }}
        </div>
        <div v-if="aiResult.stocks.length > 0">
          <div style="font-weight:600;margin-bottom:8px">匹配股票（勾选后点击确认选股）</div>
          <el-table :data="aiResult.stocks" @selection-change="selectedStocks = $event">
            <el-table-column type="selection" width="50" />
            <el-table-column prop="code" label="代码" width="100" />
            <el-table-column prop="name" label="名称" width="120" />
            <el-table-column prop="trend" label="走势" width="90" />
            <el-table-column prop="reason" label="推荐理由" min-width="200" show-overflow-tooltip />
          </el-table>
        </div>
        <div v-else style="color:#999;margin-top:12px">未解析到股票数据，请检查提示词格式要求</div>
      </template>

      <template #footer>
        <template v-if="aiStep === 1">
          <el-button @click="aiDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="executeAi" :loading="executing">确定</el-button>
        </template>
        <template v-if="aiStep === 2">
          <el-button @click="aiStep = 1">重新选择</el-button>
          <el-button type="primary" @click="confirmStocks" :loading="confirming" :disabled="selectedStocks.length === 0">
            确认选股 ({{ selectedStocks.length }})
          </el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { predictionApi, promptApi } from '@/api'

const list = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const activeTab = ref('')
const sortField = ref('')
const sortOrder = ref('')
const addDialogVisible = ref(false)
const submitting = ref(false)
const form = ref({ stock_code: '', stock_name: '', target_price: 0, stop_loss: 0, confidence: 0.7, llm_model: '', reason: '' })

const statusType = (s) => ({ active: 'primary', success: 'success', failed: 'danger', abandoned: 'info' }[s] || 'info')
const statusLabel = (s) => ({ active: '进行中', success: '成功', failed: '失败', abandoned: '已放弃' }[s] || s)

const loadList = async () => {
  loading.value = true
  try {
    const res = await predictionApi.getList({ 
      status: activeTab.value, 
      page: page.value, 
      pageSize: pageSize.value,
      sortField: sortField.value,
      sortOrder: sortOrder.value
    })
    list.value = res?.data?.list || []
    total.value = res?.data?.total || 0
  } finally {
    loading.value = false
  }
}

const handleSortChange = ({ prop, order }) => {
  sortField.value = prop || ''
  sortOrder.value = order || ''
  page.value = 1
  loadList()
}

const handleTabChange = () => {
  sortField.value = ''
  sortOrder.value = ''
  page.value = 1
  selectedRows.value = []
  selectAll.value = false
  loadList()
}

const abandon = async (row) => {
  await ElMessageBox.confirm(`确认放弃 ${row.stock_name} 的预测？`, '提示', { type: 'warning' })
  await predictionApi.abandon(row.id)
  ElMessage.success('已放弃')
  loadList()
}

// 已放弃tab的批量选择
const selectedRows = ref([])
const selectAll = ref(false)

const handleSelectionChange = (rows) => {
  selectedRows.value = rows
}

const isIndeterminate = computed(() => {
  return selectedRows.value.length > 0 && selectedRows.value.length < list.value.length
})

const handleSelectAll = (val) => {
  selectedRows.value = val ? [...list.value] : []
}

// 删除单条
const deleteRow = async (row) => {
  await ElMessageBox.confirm(`确认删除 ${row.stock_name}？`, '提示', { type: 'warning' })
  await predictionApi.delete(row.id)
  ElMessage.success('已删除')
  loadList()
}

// 恢复单条
const restore = async (row) => {
  await predictionApi.restore([row.id])
  ElMessage.success('已恢复')
  loadList()
}

// 批量删除
const batchDelete = async () => {
  await ElMessageBox.confirm(`确认删除选中的 ${selectedRows.value.length} 条记录？`, '提示', { type: 'warning' })
  const ids = selectedRows.value.map(r => r.id)
  await predictionApi.batchDelete(ids)
  ElMessage.success('已删除')
  selectedRows.value = []
  loadList()
}

// 批量放弃（仅对 active 状态生效）
const batchAbandon = async () => {
  const targets = selectedRows.value.filter(r => r.status === 'active')
  await ElMessageBox.confirm(`确认放弃选中的 ${targets.length} 条进行中记录？`, '提示', { type: 'warning' })
  for (const r of targets) await predictionApi.abandon(r.id)
  ElMessage.success(`已放弃 ${targets.length} 条`)
  selectedRows.value = []
  loadList()
}

// 批量恢复（仅对 abandoned 状态生效）
const batchRestore = async () => {
  const targets = selectedRows.value.filter(r => r.status === 'abandoned')
  const ids = targets.map(r => r.id)
  await predictionApi.restore(ids)
  ElMessage.success(`已恢复 ${ids.length} 条`)
  selectedRows.value = []
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

// AI选股
const aiDialogVisible = ref(false)
const aiStep = ref(1)
const executing = ref(false)
const confirming = ref(false)
const promptList = ref([])
const selectedStocks = ref([])
const aiForm = ref({ prompt_id: null, observation_period: '一月' })
const aiResult = ref({ raw_response: '', stocks: [], analysis: '', prompt_id: null, prompt_name: '', llm_model: '', observation_period: '一月' })

const openAiDialog = async () => {
  aiStep.value = 1
  aiForm.value = { prompt_id: null, observation_period: '一月' }
  aiResult.value = { raw_response: '', stocks: [], analysis: '', prompt_id: null, prompt_name: '', llm_model: '', observation_period: '一月' }
  selectedStocks.value = []
  const res = await promptApi.getList()
  promptList.value = res?.data || []
  aiDialogVisible.value = true
}

const executeAi = async () => {
  if (!aiForm.value.prompt_id) {
    ElMessage.warning('请选择提示词')
    return
  }
  executing.value = true
  try {
    const res = await predictionApi.execute(aiForm.value)
    if (res?.code !== 0) {
      ElMessage.error(res?.message || '执行失败')
      return
    }
    aiResult.value = res.data
    aiStep.value = 2
  } catch (e) {
    ElMessage.error('请求失败：' + (e.response?.data?.message || e.message))
  } finally {
    executing.value = false
  }
}

const confirmStocks = async () => {
  if (selectedStocks.value.length === 0) return
  confirming.value = true
  try {
    const res = await predictionApi.confirm({
      stocks: selectedStocks.value,
      prompt_id: aiResult.value.prompt_id,
      prompt_name: aiResult.value.prompt_name,
      llm_model: aiResult.value.llm_model,
      llm_response: aiResult.value.raw_response,
      observation_period: aiResult.value.observation_period
    })
    if (res?.code === 0) {
      ElMessage.success(`已保存 ${selectedStocks.value.length} 只股票`)
      aiDialogVisible.value = false
      loadList()
    } else {
      ElMessage.error(res?.message || '保存失败')
    }
  } finally {
    confirming.value = false
  }
}

onMounted(loadList)
</script>

<style scoped>
.mb-4 { margin-bottom: 16px; }
.mt-4 { margin-top: 16px; }
</style>
