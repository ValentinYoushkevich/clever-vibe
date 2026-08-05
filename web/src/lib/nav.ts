import { canAccessAdmin, canCreateEntry } from './permissions.js'
import type { Role } from './permissions.js'

export interface Tab {
  path: string
  title: string
}

export function tabsFor(role: Role): Tab[] {
  const tabs: Tab[] = []
  if (canCreateEntry(role)) {
    tabs.push({ path: '/', title: 'Быстрый ввод' })
    tabs.push({ path: '/mine', title: 'Мои записи' })
  }
  tabs.push({ path: '/dashboard', title: 'Дашборд' })
  if (canAccessAdmin(role)) tabs.push({ path: '/admin', title: 'Администрирование' })
  return tabs
}

export const defaultRoute = (role: Role) => (role === 'observer' ? '/dashboard' : '/')
