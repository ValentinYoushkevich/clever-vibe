export type Role = 'dev' | 'lead' | 'admin' | 'observer'

export const canCreateEntry = (r: Role) => r !== 'observer'
export const canViewDashboard = (_r: Role) => true
export const canExportCsv = (r: Role) => r === 'lead' || r === 'admin' || r === 'observer'
export const canAccessAdmin = (r: Role) => r === 'lead' || r === 'admin'
// Лид может только деактивировать участника, админ — ещё и удалить насовсем
export const canDeleteUser = (r: Role) => r === 'admin'
