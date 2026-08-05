import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import LoginView from '../src/views/LoginView.vue'

describe('LoginView', () => {
  it('кнопка неактивна при пустых полях', () => {
    const w = mount(LoginView, {
      global: {
        plugins: [createPinia()],
        stubs: { RouterLink: true },
        mocks: { $router: { push: () => {} } },
      },
    })
    expect(w.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})
