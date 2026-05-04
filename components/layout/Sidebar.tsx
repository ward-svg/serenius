'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { group: 'Partners', items: [
    { href: '/partners', label: 'Partners', d: 'M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0H3z' },
    { href: '/pledges', label: 'Pledges', d: 'M2 2h12v2H2zm0 4h8v2H2zm0 4h10v2H2z' },
    { href: '/gifts', label: 'Gifts', d: 'M8 1l2 5h5l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5z' },
    { href: '/inkind', label: 'In-Kind Gifts', d: 'M8 3a2 2 0 00-2-2 2 2 0 00-2 2H2v3h12V3h-2a2 2 0 00-2-2 2 2 0 00-2 2zM2 8v6h12V8H2z' },
    { href: '/communications', label: 'Communications', d: 'M2 3h12v2l-6 5-6-5V3zm0 4l6 5 6-5v5H2V7z' },
  ]},
  { group: 'Operations', items: [
    { href: '/banking', label: 'Banking', d: 'M1 5l7-4 7 4H1zm1 1h12v1H2zm1 2h2v5H3zm4 0h2v5H7zm4 0h2v5h-2zM2 13h12v2H2z' },
    { href: '/quick-entry', label: 'Quick Entry', d: 'M9 1L4 9h5l-2 6 7-8H9l2-6z' },
  ]},
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <div style={{width:220,minWidth:220,background:'#1e2433',display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{padding:'20px 18px 16px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{fontSize:15,fontWeight:500,color:'#fff',letterSpacing:0.3}}>Serenius</div>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>WellSpring Rescue</div>
      </div>
      <nav style={{flex:1,overflowY:'auto',padding:'10px 0'}}>
        {nav.map(group => (
          <div key={group.group} style={{padding:'8px 10px 4px'}}>
            <div style={{fontSize:10,fontWeight:500,color:'rgba(255,255,255,0.3)',letterSpacing:'1px',textTransform:'uppercase',padding:'0 8px',marginBottom:4}}>
              {group.group}
            </div>
            {group.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href}
                  style={{display:'flex',alignItems:'center',gap:9,padding:'7px 10px',borderRadius:6,fontSize:13,fontWeight:active?500:400,color:active?'#fff':'rgba(255,255,255,0.55)',background:active?'#3b5bdb':'transparent',textDecoration:'none',marginBottom:1,transition:'all 0.15s'}}
                  onMouseEnter={e=>{if(!active){(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.07)';(e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.85)'}}}
                  onMouseLeave={e=>{if(!active){(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.55)'}}}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" style={{width:15,height:15,flexShrink:0}}>
                    <path d={item.d}/>
                  </svg>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div style={{borderTop:'1px solid rgba(255,255,255,0.08)',padding:'10px 10px 14px'}}>
        <div style={{display:'flex',alignItems:'center',gap:9,padding:'7px 10px',fontSize:13,color:'rgba(255,255,255,0.55)'}}>
          <div style={{width:26,height:26,borderRadius:'50%',background:'rgba(59,91,219,0.35)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:600,color:'#93b4ff',flexShrink:0}}>WM</div>
          <div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.75)'}}>Ward McMillen</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>Administrator</div>
          </div>
        </div>
      </div>
    </div>
  )
}
