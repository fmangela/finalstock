// 前端应用入口
// 注册全局插件：Pinia（状态管理）、Vue Router、Element Plus（UI 组件库）
// 批量注册 Element Plus 图标，供侧边栏菜单等处使用
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

// 全局注册所有 Element Plus 图标组件，在模板中可直接使用 <el-icon><House /></el-icon>
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
