import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import './style.css'
import App from './App.vue'
import { CleverVibePreset } from './theme/primevuePreset.js'
import { applyTheme, getSavedTheme } from './lib/theme.js'
import { router } from './router.js'
import { useAuth } from './stores/auth.js'
import { setUnauthorizedHandler } from './api/client.js'
import { defaultRoute } from './lib/nav.js'

applyTheme(getSavedTheme()) // синхронизирует data-dark и localStorage

const app = createApp(App)
app.use(createPinia())
app.use(PrimeVue, {
  theme: {
    preset: CleverVibePreset,
    options: { darkModeSelector: '[data-dark]' },
  },
})
app.use(ToastService)
app.use(router)

// Автовход: связка из localStorage поднимается синхронно, поэтому форма входа
// не мигает и старт не ждёт сеть. Профиль сверяется с сервером в фоне;
// выкидывает из приложения только «Выйти» или отказ сервера (401).
const auth = useAuth()
auth.restore()
setUnauthorizedHandler(() => {
  auth.logout()
  void router.push('/login')
})
void auth.refresh().then(() => {
  // Записи прежнего формата (без профиля) логинят уже после ответа сервера
  if (auth.user && router.currentRoute.value.path === '/login') {
    void router.push(defaultRoute(auth.user.role))
  }
})

app.mount('#app')
