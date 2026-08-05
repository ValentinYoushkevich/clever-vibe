import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import './style.css'
import App from './App.vue'
import { CleverVibePreset } from './theme/primevuePreset.js'
import { applyTheme, getSavedTheme } from './lib/theme.js'

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
app.mount('#app')
