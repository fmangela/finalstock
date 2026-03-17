<template>
  <el-container class="layout">
    <el-aside width="200px" class="sidebar">
      <div class="logo">Final Stock</div>
      <el-menu :router="true" :default-active="$route.path" background-color="#001529" text-color="#ccc" active-text-color="#fff">
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="page-title">{{ $route.meta.title }}</span>
        <span class="time">{{ currentTime }}</span>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const menuItems = [
  { path: '/finalstock/home', title: '首页', icon: 'House' },
  { path: '/finalstock/stock', title: 'A股行情', icon: 'TrendCharts' },
  { path: '/finalstock/news', title: '市场资讯', icon: 'Newspaper' },
  { path: '/finalstock/prediction', title: 'LLM选股', icon: 'MagicStick' },
  { path: '/finalstock/backtest', title: '股票回测', icon: 'DataAnalysis' },
  { path: '/finalstock/simulation', title: '模拟交易', icon: 'Coin' },
  { path: '/finalstock/workflow', title: '自动流程', icon: 'Cpu' },
  { path: '/finalstock/settings', title: '系统设置', icon: 'Setting' }
]

const currentTime = ref('')
let timer = null

const updateTime = () => {
  currentTime.value = new Date().toLocaleString('zh-CN')
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
})

onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.layout { height: 100vh; }
.sidebar { background: #001529; }
.logo { color: #fff; font-size: 18px; font-weight: bold; padding: 20px; text-align: center; border-bottom: 1px solid #1a2a3a; }
.header { background: #fff; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; padding: 0 20px; }
.page-title { font-size: 16px; font-weight: 600; }
.time { color: #999; font-size: 13px; }
.main { background: #f5f7fa; padding: 20px; }
</style>
