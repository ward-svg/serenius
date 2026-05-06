import { SERENIUS_MODULES } from './registry'
import type {
  SereniusModuleDefinition,
  SereniusNavGroup,
} from './types'

export interface NavItem {
  href: string
  label: string
  d: string
  key: string
}

export interface NavGroup {
  group: SereniusNavGroup
  items: NavItem[]
}

export function getNavigationForTenant(
  slug: string,
  options?: {
    includeAdmin?: boolean
  }
): NavGroup[] {
  const includeAdmin = options?.includeAdmin ?? false

  const visibleModules = SERENIUS_MODULES.filter(module => {
    if (!module.enabledByDefault) return false
    if (module.adminOnly && !includeAdmin) return false
    return true
  })

  const groups = visibleModules.reduce((map, module) => {
    if (!map.has(module.group)) {
      map.set(module.group, [])
    }

    map.get(module.group)?.push(toNavItem(module, slug))

    return map
  }, new Map<SereniusNavGroup, NavItem[]>())

  return Array.from(groups.entries()).map(([group, items]) => ({
    group,
    items,
  }))
}

function toNavItem(
  module: SereniusModuleDefinition,
  slug: string
): NavItem {
  return {
    key: module.key,
    href: `/${slug}${module.path}`,
    label: module.label,
    d: module.iconPath,
  }
}