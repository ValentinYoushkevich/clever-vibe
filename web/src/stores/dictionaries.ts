import { defineStore } from 'pinia'
import { api } from '../api/client.js'
import type { Stage, Approach, Tool } from '../api/types.js'

export const useDictionaries = defineStore('dictionaries', {
  state: () => ({
    stages: [] as Stage[],
    approaches: [] as Approach[],
    tools: [] as Tool[],
    loaded: false,
  }),
  getters: {
    approachesByStage: (s) => (stageId: string) =>
      s.approaches.filter((a) => a.stageId === stageId),
  },
  actions: {
    async load() {
      if (this.loaded) return
      ;[this.stages, this.approaches, this.tools] = await Promise.all([
        api<Stage[]>('/api/stages'),
        api<Approach[]>('/api/approaches'),
        api<Tool[]>('/api/tools'),
      ])
      this.loaded = true
    },
  },
})
