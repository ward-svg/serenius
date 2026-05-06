export type SereniusModuleKey =
  | 'partners'
  | 'pledges'
  | 'gifts'
  | 'inkind'
  | 'communications'
  | 'banking'
  | 'quick-entry'
  | 'setup'

export type SereniusNavGroup =
  | 'Partners'
  | 'Operations'
  | 'Admin'

export interface SereniusModuleDefinition {
  key: SereniusModuleKey
  label: string
  group: SereniusNavGroup
  path: string
  iconPath: string
  requiredRoles?: string[]
  adminOnly?: boolean
  enabledByDefault: boolean
}
