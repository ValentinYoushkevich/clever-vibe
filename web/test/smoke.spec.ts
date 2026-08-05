import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../src/App.vue'

describe('App', () => {
  it('монтируется', () => {
    const w = mount(App)
    expect(w.text()).toContain('Clever Vibe')
  })
})
