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

// Автовход до монтирования — без мигания формы входа (ТЗ §3.1)
await useAuth().tryAutoLogin()
app.mount('#app')
