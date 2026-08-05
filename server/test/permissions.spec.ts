import { describe, it, expect } from 'vitest'
import {
  canCreateEntry, canViewMine, canViewDashboard, canExportCsv,
  canManageApproaches, canAccessAdmin, canCreateUser, canDeactivateUser, canSeePassword,
} from '../src/lib/permissions.js'

const roles = ['dev', 'lead', 'admin', 'observer'] as const

describe('permissions (матрица ТЗ §2.1.1)', () => {
  it('вносить записи: dev, lead, admin', () => {
    expect(roles.map(canCreateEntry)).toEqual([true, true, true, false])
  })
  it('мои записи: dev, lead, admin', () => {
    expect(roles.map(canViewMine)).toEqual([true, true, true, false])
  })
  it('дашборд: все', () => {
    expect(roles.map(canViewDashboard)).toEqual([true, true, true, true])
  })
  it('экспорт CSV: lead, admin, observer', () => {
    expect(roles.map(canExportCsv)).toEqual([false, true, true, true])
  })
  it('справочник и промоут: lead, admin', () => {
    expect(roles.map(canManageApproaches)).toEqual([false, true, true, false])
    expect(roles.map(canAccessAdmin)).toEqual([false, true, true, false])
  })
  it('создание участников: lead — только dev; admin — все роли', () => {
    expect(canCreateUser('lead', 'dev')).toBe(true)
    expect(canCreateUser('lead', 'lead')).toBe(false)
    expect(canCreateUser('lead', 'observer')).toBe(false)
    expect(canCreateUser('admin', 'dev')).toBe(true)
    expect(canCreateUser('admin', 'admin')).toBe(true)
    expect(canCreateUser('dev', 'dev')).toBe(false)
    expect(canCreateUser('observer', 'dev')).toBe(false)
  })
  it('деактивация: lead — только dev; admin — всех', () => {
    expect(canDeactivateUser('lead', 'dev')).toBe(true)
    expect(canDeactivateUser('lead', 'lead')).toBe(false)
    expect(canDeactivateUser('lead', 'observer')).toBe(false)
    expect(canDeactivateUser('admin', 'lead')).toBe(true)
    expect(canDeactivateUser('dev', 'dev')).toBe(false)
  })
  it('пароли: лид — только созданных им; админ — всех', () => {
    const lead = { id: 'L1', role: 'lead' as const }
    expect(canSeePassword(lead, { createdById: 'L1' })).toBe(true)
    expect(canSeePassword(lead, { createdById: 'L2' })).toBe(false)
    expect(canSeePassword({ id: 'A', role: 'admin' }, { createdById: null })).toBe(true)
    expect(canSeePassword({ id: 'D', role: 'dev' }, { createdById: 'D' })).toBe(false)
  })
})
