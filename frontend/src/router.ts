import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import Practice from './views/Practice.vue'
import ErrorWords from './views/ErrorWords.vue'
import YesterdayErrors from './views/YesterdayErrors.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/practice', component: Practice },
  { path: '/error-words', component: ErrorWords },
  { path: '/yesterday-errors', component: YesterdayErrors }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
