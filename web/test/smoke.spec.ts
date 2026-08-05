import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../src/App.vue'

describe('App', () => {
  it('монтируется', () => {
    const w = mount(App)
    expect(w.find('h1').text()).toBe('Clever Vibe')
  })
})
