'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { getNavigationForTenant } from '@/lib/modules/navigation'

interface Props {
  orgName: string
  appName: string
  slug: string
}

export default function Sidebar({ orgName, appName, slug }: Props) {
  const pathname = usePathname()
  const nav = getNavigationForTenant(slug)
  const [canSeeSetup, setCanSeeSetup] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    async function checkRoles() {
      const [{ data: isSuperAdmin }, { data: isTenantAdmin }] = await Promise.all([
        supabase.rpc('has_role', { role_name: 'superadmin' }),
        supabase.rpc('has_role', { role_name: 'tenant_admin' }),
      ])
      setCanSeeSetup(!!(isSuperAdmin || isTenantAdmin))
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
              {appName}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {orgName}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
        {nav.map(group => (
          <div key={group.group} style={{ padding: '8px 10px 4px' }}>
            <div style={{
              fontSize: 10,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.3)',
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
                    <path d={item.d} />
                  </svg>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}

        {canSeeSetup && (() => {
          const href = `/${slug}/setup`
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
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
            </div>
          )
        })()}
      </nav>

      {/* Tenant switcher for admin */}
      <div style={{
        padding: '8px 10px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          padding: '0 8px',
          marginBottom: 4,
        }}>
          Switch Tenant
        </div>
        {['wellspring', 'shorechristian'].map(s => (
          <Link
            key={s}
            href={`/${s}/partners`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 10px',
              borderRadius: 5,
              fontSize: 12,
              color: slug === s ? '#fff' : 'rgba(255,255,255,0.45)',
              background: slug === s ? 'rgba(255,255,255,0.1)' : 'transparent',
              textDecoration: 'none',
              marginBottom: 1,
            }}
          >
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: slug === s ? 'var(--brand-primary, #3b5bdb)' : 'rgba(255,255,255,0.2)',
              flexShrink: 0,
            }} />
            {s === 'wellspring' ? 'WellSpring' : 'Shore Christian'}
          </Link>
        ))}
      </div>

      {/* User */}
      <div style={{ padding: '10px 10px 14px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '7px 10px',
          fontSize: 13,
          color: 'rgba(255,255,255,0.6)',
        }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            color: '#fff',
            flexShrink: 0,
          }}>
            WM
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Ward McMillen</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Administrator</div>
          </div>
        </div>
      </div>
    </div>
  )
}
