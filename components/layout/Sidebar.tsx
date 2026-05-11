'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { logout } from '@/lib/actions'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { getNavigationForTenant } from '@/lib/modules/navigation'

interface Props {
  orgName: string
  appName: string
  slug?: string
  showPrimaryNav?: boolean
  platformMode?: boolean
}

interface UserProfileSummary {
  full_name: string | null
  email: string | null
}

export default function Sidebar({ orgName, appName, slug, showPrimaryNav = true, platformMode = false }: Props) {
  const pathname = usePathname()
  const nav = showPrimaryNav && slug ? getNavigationForTenant(slug) : []
  const [canSeeSetup, setCanSeeSetup] = useState(false)
  const [canSeePlatformAdmin, setCanSeePlatformAdmin] = useState(false)
  const [currentUserLabel, setCurrentUserLabel] = useState('Account')

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    async function checkRoles() {
      const [{ data: authRes }, { data: isSuperAdmin }, { data: isTenantAdmin }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc('has_role', { role_name: 'superadmin' }),
        supabase.rpc('has_role', { role_name: 'tenant_admin' }),
      ])
      setCanSeeSetup(!!(isSuperAdmin || isTenantAdmin))
      setCanSeePlatformAdmin(!!isSuperAdmin)

      const userId = authRes.user?.id
      if (!userId) {
        setCurrentUserLabel(authRes.user?.email ?? 'Account')
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email')
        .eq('user_id', userId)
        .maybeSingle<UserProfileSummary>()

      setCurrentUserLabel(profile?.full_name || profile?.email || authRes.user?.email || 'Account')
    }
    checkRoles()
  }, [slug])

  return (
    <div style={{
      width: 220,
      minWidth: 220,
      background: 'var(--brand-sidebar, #1e2433)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Logo */}
      <div style={{
        padding: '18px 18px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <Image
            src="/brand/serenius-logo-core-white.svg"
            alt="Serenius"
            width={28}
            height={28}
            style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
          />
          <div>
            <div style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--brand-sidebar-text, #ffffff)',
              letterSpacing: 0.3,
              fontFamily: 'var(--brand-font-heading, Inter)',
            }}>
              {platformMode ? 'Serenius' : appName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--brand-sidebar-dim, rgba(255,255,255,0.45))', marginTop: 2 }}>
              {platformMode ? 'Platform Administration' : orgName}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      {nav.length > 0 && (
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {nav.map(group => (
            <div key={group.group} style={{ padding: '8px 10px 4px' }}>
              <div style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'var(--brand-sidebar-muted, rgba(255,255,255,0.3))',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                padding: '0 8px',
                marginBottom: 4,
              }}>
                {group.group}
              </div>
              {group.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '7px 10px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                      color: active ? 'var(--brand-sidebar-text, #fff)' : 'var(--brand-sidebar-muted, rgba(255,255,255,0.6))',
                      background: active ? 'var(--brand-sidebar-active-bg, rgba(255,255,255,0.12))' : 'transparent',
                      textDecoration: 'none',
                      marginBottom: 1,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'var(--brand-sidebar-hover-bg, rgba(255,255,255,0.08))'
                        ;(e.currentTarget as HTMLElement).style.color = 'var(--brand-sidebar-text, #fff)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLElement).style.color = 'var(--brand-sidebar-muted, rgba(255,255,255,0.6))'
                      }
                    }}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15, flexShrink: 0 }}>
                      <path d={item.d} />
                    </svg>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}

          {canSeeSetup && slug && !platformMode && (
            <div style={{ padding: '8px 10px 4px' }}>
              <div style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.3)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                padding: '0 8px',
                marginBottom: 4,
              }}>
                Admin
              </div>
              {(() => {
                const href = `/${slug}/setup`
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    href={href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '7px 10px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                      color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                      background: active ? 'var(--brand-primary, #3b5bdb)' : 'transparent',
                      textDecoration: 'none',
                      marginBottom: 1,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'
                        ;(e.currentTarget as HTMLElement).style.color = '#fff'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'
                      }
                    }}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15, flexShrink: 0 }}>
                      <path fillRule="evenodd" d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 01-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 01.872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 012.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 012.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 01.872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 01-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 01-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 110-5.86 2.929 2.929 0 010 5.858z" />
                    </svg>
                    Setup
                  </Link>
                )
              })()}
            </div>
          )}
        </nav>
      )}

      {/* Lower actions */}
      <div style={{ marginTop: 'auto', padding: '10px 10px 14px' }}>
        {canSeePlatformAdmin && (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 500,
              color: 'var(--brand-sidebar-muted, rgba(255,255,255,0.32))',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '0 8px',
              marginBottom: 6,
            }}>
              Serenius Platform
            </div>
              <Link
                href="/platform-admin/switch-tenant"
                style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 5,
                fontSize: 12,
                color: 'var(--brand-sidebar-muted, rgba(255,255,255,0.68))',
                textDecoration: 'none',
                marginBottom: 2,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.background = 'var(--brand-sidebar-hover-bg, rgba(255,255,255,0.08))'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--brand-sidebar-text, #fff)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--brand-sidebar-muted, rgba(255,255,255,0.68))'
              }}
              title="Superadmin only"
            >
              Switch Tenant
            </Link>
              <Link
                href="/platform-admin"
                style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 5,
                fontSize: 12,
                color: pathname === '/platform-admin' ? 'var(--brand-sidebar-text, #fff)' : 'var(--brand-sidebar-muted, rgba(255,255,255,0.55))',
                background: pathname === '/platform-admin' ? 'var(--brand-sidebar-active-bg, rgba(255,255,255,0.1))' : 'transparent',
                textDecoration: 'none',
                marginTop: 2,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (pathname !== '/platform-admin') {
                  (e.currentTarget as HTMLElement).style.background = 'var(--brand-sidebar-hover-bg, rgba(255,255,255,0.08))'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--brand-sidebar-text, #fff)'
                }
              }}
              onMouseLeave={e => {
                if (pathname !== '/platform-admin') {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--brand-sidebar-muted, rgba(255,255,255,0.55))'
                }
              }}
              title="Superadmin only"
            >
              Tenant Admin
            </Link>
          </div>
        )}

        <div style={{
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--brand-sidebar-muted, rgba(255,255,255,0.32))',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          padding: '0 8px',
          marginBottom: 6,
        }}>
          Account
        </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '7px 10px 5px',
            fontSize: 13,
            color: 'var(--brand-sidebar-muted, rgba(255,255,255,0.6))',
          }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'var(--brand-sidebar-active-bg, rgba(255,255,255,0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            color: '#fff',
            flexShrink: 0,
          }}>
            {currentUserLabel.trim().charAt(0).toUpperCase() || 'A'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--brand-sidebar-text, rgba(255,255,255,0.9))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUserLabel}
            </div>
            <div style={{ fontSize: 10, color: 'var(--brand-sidebar-dim, rgba(255,255,255,0.4))' }}>
              Current user
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled
          title="Coming soon"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            borderRadius: 5,
            border: 'none',
            background: 'transparent',
            color: 'var(--brand-sidebar-muted, rgba(255,255,255,0.55))',
            fontSize: 12,
            textAlign: 'left',
            cursor: 'not-allowed',
            marginTop: 2,
          }}
        >
          Profile / Account
        </button>
        <form action={logout} style={{ marginTop: 2 }}>
          <button
            type="submit"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
            padding: '6px 10px',
            borderRadius: 5,
            border: 'none',
            background: 'transparent',
            color: 'var(--brand-sidebar-text, rgba(255,255,255,0.78))',
            fontSize: 12,
            textAlign: 'left',
            cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
