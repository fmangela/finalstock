// 前端路由配置
// 所有页面挂载在 /finalstock 路径下，使用懒加载（import()）减少首屏体积
// 根路径 / 自动重定向到首页
import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/layouts/Layout.vue'

const routes = [
  {
    path: '/finalstock',
    component: Layout,          // 公共布局（侧边栏 + 顶栏）
    redirect: '/finalstock/home',
    children: [
      { path: 'home',       component: () => import('@/views/home/Index.vue'),       meta: { title: '首页' } },
      { path: 'stock',      component: () => import('@/views/stock/Index.vue'),      meta: { title: 'A股行情' } },
      { path: 'news',       component: () => import('@/views/news/Index.vue'),       meta: { title: '市场资讯' } },
      { path: 'prediction', component: () => import('@/views/prediction/Index.vue'), meta: { title: 'LLM选股' } },
      { path: 'backtest',   component: () => import('@/views/backtest/Index.vue'),   meta: { title: '股票回测' } },
      { path: 'simulation', component: () => import('@/views/simulation/Index.vue'), meta: { title: '模拟交易' } },
      { path: 'simulation/:id', component: () => import('@/views/simulation/Detail.vue'), meta: { title: '模拟交易详情' } },
      { path: 'workflow',   component: () => import('@/views/workflow/Index.vue'),   meta: { title: '自动流程' } },
      { path: 'settings',   component: () => import('@/views/settings/Index.vue'),   meta: { title: '系统设置' } }
    ]
  },
  { path: '/', redirect: '/finalstock/home' }  // 根路径重定向
]

export default createRouter({
  history: createWebHistory(),
  routes
})
