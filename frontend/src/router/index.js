import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/layouts/Layout.vue'

const routes = [
  {
    path: '/finalstock',
    component: Layout,
    redirect: '/finalstock/home',
    children: [
      { path: 'home', component: () => import('@/views/home/Index.vue'), meta: { title: '首页' } },
      { path: 'stock', component: () => import('@/views/stock/Index.vue'), meta: { title: 'A股行情' } },
      { path: 'news', component: () => import('@/views/news/Index.vue'), meta: { title: '市场资讯' } },
      { path: 'prediction', component: () => import('@/views/prediction/Index.vue'), meta: { title: 'LLM选股' } },
      { path: 'backtest', component: () => import('@/views/backtest/Index.vue'), meta: { title: '股票回测' } },
      { path: 'simulation', component: () => import('@/views/simulation/Index.vue'), meta: { title: '模拟交易' } },
      { path: 'settings', component: () => import('@/views/settings/Index.vue'), meta: { title: '系统设置' } }
    ]
  },
  { path: '/', redirect: '/finalstock/home' }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
