import type { RouteRecordRaw } from 'vue-router'
import { createWebHistory, createRouter } from 'vue-router'
import Main from './views/Main.vue'
import Preferences from './views/Preferences.vue'
import Presentation from './views/Presentation.vue'
import Devtools from './views/Devtools.vue'
import DouBao from './views/DouBao.vue'

const history = createWebHistory()
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Main,
    children: [{ path: '/doubao', component: DouBao }]
  },
  { path: '/preferences', component: Preferences },
  { path: '/presentation', component: Presentation },
  { path: '/devtools', component: Devtools }
]

const router = createRouter({ history, routes })

export default router
