'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const labels: Record<string, string> = {
  partners: 'Partners',
  pledges: 'Pledges',
  gifts: 'Gifts',
  inkind: 'In-Kind Gifts',
  communications: 'Communications',
  banking: 'Banking',
  'quick-entry': 'Quick Entry',
  add: 'Add Partner',
}

interface Props {
  orgName: string
  slug: string
}

export default function TopBar({ orgName, slug }: Props) {
  const pathname = usePathname()

  // Strip the slug from segments for breadcrumb display
  const segments = pathname.split('/').filter(Boolean).filter(s => s !== slug)

  const crumbs = segments.map((seg, i) => ({
    label: labels[seg] || seg.charAt(0).toUpperCase() + seg.slice(1),
    href: '/' + slug + '/' + segments.slice(0, i + 1).join('/'),
  }))

  return (
    <div style={{
      height: 52,
      background: '#fff',
      borderBottom: '1px solid #e4e4e0',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <Link
          href={`/${slug}/partners`}
          style={{ color: '#9ca3af', textDecoration: 'none' }}
        >
          Home
        </Link>
        {crumbs.map((c, i) => (
          <span key={c.href} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#d1d5db' }}>/</span>
            {i === crumbs.length - 1
              ? <span style={{ fontWeight: 500, color: '#374151' }}>{c.label}</span>
              : <Link href={c.href} style={{ color: '#9ca3af', textDecoration: 'none' }}>{c.label}</Link>
            }
          </span>
        ))}
      </div>
      <div style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
        {orgName}&nbsp;·&nbsp;Logged in as <strong style={{ color: '#4b5563' }}>Ward McMillen</strong>
      </div>
    </div>
  )
}
