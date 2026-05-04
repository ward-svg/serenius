'use client'

import { useEffect } from 'react'
import type { TenantConfig } from '@/lib/tenant'

interface Props {
  config: TenantConfig
  children: React.ReactNode
}

export default function TenantProvider({ config, children }: Props) {
  const { branding } = config

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--brand-primary', branding.primary_color)
    root.style.setProperty('--brand-secondary', branding.secondary_color)
    root.style.setProperty('--brand-accent', branding.accent_color)
    root.style.setProperty('--brand-alert', branding.alert_color)
    root.style.setProperty('--brand-sidebar', branding.sidebar_color)
    root.style.setProperty('--brand-font-heading', branding.font_heading)
    root.style.setProperty('--brand-font-body', branding.font_body)
    document.title = config.branding.app_name

    const fonts = [...new Set([branding.font_heading, branding.font_body])]
    const existingLink = document.getElementById('tenant-fonts')
    if (existingLink) existingLink.remove()
    const fontQuery = fonts.filter(f => f !== 'system-ui')
      .map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&')
    if (fontQuery) {
      const link = document.createElement('link')
      link.id = 'tenant-fonts'
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?${fontQuery}&display=swap`
      document.head.appendChild(link)
    }
  }, [config, branding])

  return <>{children}</>
}
