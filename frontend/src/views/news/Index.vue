<template>
  <div>
    <el-card shadow="hover">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>市场资讯</span>
          <el-button type="primary" size="small" @click="refresh" :loading="refreshing">刷新</el-button>
        </div>
      </template>
      <el-table :data="news" v-loading="loading" stripe>
        <el-table-column prop="source" label="来源" width="100" />
        <el-table-column prop="title" label="标题" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            <a v-if="row.source_url" :href="row.source_url" target="_blank" rel="noopener noreferrer">{{ row.title }}</a>
            <span v-else>{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="pub_date" label="时间" width="180">
          <template #default="{ row }">{{ formatDate(row.pub_date) }}</template>
        </el-table-column>
        <el-table-column prop="sentiment_score" label="情感" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.sentiment_score !== undefined" :type="sentimentType(row.sentiment_score)" size="small">
              {{ row.sentiment_score > 0 ? '正面' : row.sentiment_score < 0 ? '负面' : '中性' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button size="small" @click="viewNews(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="mt-4"
        :total="total"
        :page-size="pageSize"
        :page-sizes="[20, 50, 100]"
        :current-page="page"
        @current-change="onPageChange"
        @size-change="onSizeChange"
        layout="total, sizes, prev, pager, next"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="selectedNews?.title" width="700px">
      <p style="line-height:1.8;white-space:pre-wrap">{{ selectedNews?.content }}</p>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { newsApi } from '@/api'

const news = ref([])
const loading = ref(false)
const refreshing = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const dialogVisible = ref(false)
const selectedNews = ref(null)
let autoRefreshTimer = null

const sentimentType = (score) => {
  if (score > 0) return 'success'
  if (score < 0) return 'danger'
  return 'info'
}

const formatDate = (d) => d ? new Date(d).toLocaleString('zh-CN') : '-'

const loadNews = async () => {
  loading.value = true
  try {
    const res = await newsApi.getList({ page: page.value, pageSize: pageSize.value })
    news.value = res?.data || []
    total.value = res?.total ?? news.value.length
  } finally {
    loading.value = false
  }
}

const refresh = async () => {
  refreshing.value = true
  try {
    await newsApi.refresh()
    page.value = 1
    await loadNews()
  } finally {
    refreshing.value = false
  }
}

const onPageChange = (p) => { page.value = p; loadNews() }
const onSizeChange = (s) => { pageSize.value = s; page.value = 1; loadNews() }
const viewNews = (item) => { selectedNews.value = item; dialogVisible.value = true }

onMounted(() => {
  loadNews()
  // 每5分钟静默拉取一次最新数据（只更新第一页）
  autoRefreshTimer = setInterval(async () => {
    if (page.value === 1 && !loading.value && !refreshing.value) {
      await loadNews()
    }
  }, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
})
</script>

<style scoped>
.mt-4 { margin-top: 16px; }
</style>
