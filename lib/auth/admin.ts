import 'server-only'

import { createSupabaseServiceClient } from '@/lib/supabase-service'

export interface AuthUserSummary {
  id: string
  email: string | null
  user_metadata?: Record<string, unknown>
}

const PAGE_SIZE = 200

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function findAuthUserByEmail(email: string): Promise<AuthUserSummary | null> {
  const supabase = createSupabaseServiceClient()
  const targetEmail = normalizeEmail(email)

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
    if (error) {
      throw error
    }

    const found = data.users.find(user => normalizeEmail(user.email ?? '') === targetEmail)
    if (found) {
      return {
        id: found.id,
        email: found.email ?? null,
        user_metadata: found.user_metadata ?? {},
      }
    }

    if (data.users.length < PAGE_SIZE) {
      return null
    }
  }

  return null
}

export async function inviteAuthUserByEmail(email: string, fullName?: string | null): Promise<AuthUserSummary> {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
  })

  if (error) {
    throw error
  }

  if (!data.user) {
    throw new Error('Auth invite did not return a user.')
  }

  return {
    id: data.user.id,
    email: data.user.email ?? email,
    user_metadata: data.user.user_metadata ?? {},
  }
}

export async function ensureAuthUserForTenantAdmin(
  email: string,
  fullName?: string | null,
): Promise<AuthUserSummary> {
  const existing = await findAuthUserByEmail(email)
  if (existing) {
    return existing
  }

  return inviteAuthUserByEmail(email, fullName)
}
