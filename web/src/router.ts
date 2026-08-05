import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './stores/auth.js'
import { defaultRoute } from './lib/nav.js'
import LoginView from './views/LoginView.vue'
import QuickEntryView from './views/QuickEntryView.vue'
import MyEntriesView from './views/MyEntriesView.vue'
import DashboardView from './views/DashboardView.vue'
import AdminView from './views/AdminView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/', component: QuickEntryView },
    { path: '/mine', component: MyEntriesView },
    { path: '/dashboard', component: DashboardView },
    // /admin доступен по URL любой роли: сама вью показывает плашку
    // «экран недоступен для вашей роли» (ТЗ §3.5)
    { path: '/admin', component: AdminView },
  ],
})

router.beforeEach((to) => {
  const auth = useAuth()
  if (!auth.user && !to.meta.public) return '/login'
  if (auth.user && to.path === '/login') return defaultRoute(auth.user.role)
  // observer не имеет быстрого ввода и «моих записей»
  if (auth.user?.role === 'observer' && (to.path === '/' || to.path === '/mine'))
    return '/dashboard'
})
