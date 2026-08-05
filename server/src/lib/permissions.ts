export type Role = 'dev' | 'lead' | 'admin' | 'observer'

export const canCreateEntry = (r: Role) => r !== 'observer'
export const canViewMine = canCreateEntry
export const canViewDashboard = (_r: Role) => true
export const canExportCsv = (r: Role) => r === 'lead' || r === 'admin' || r === 'observer'
export const canManageApproaches = (r: Role) => r === 'lead' || r === 'admin'
export const canAccessAdmin = canManageApproaches

export const canCreateUser = (creator: Role, target: Role) =>
  target === 'dev' ? creator === 'lead' || creator === 'admin' : creator === 'admin'

export const canDeactivateUser = (actor: Role, target: Role) =>
  actor === 'admin' || (actor === 'lead' && target === 'dev')

// Перманентное удаление участника — только админ; лиду доступна лишь деактивация
export const canDeleteUser = (actor: Role) => actor === 'admin'

export const canSeePassword = (
  viewer: { id: string; role: Role },
  target: { createdById: string | null },
) => viewer.role === 'admin' || (viewer.role === 'lead' && target.createdById === viewer.id)
