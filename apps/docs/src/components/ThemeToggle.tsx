'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        style={{
          width: 32,
          height: 32,
          opacity: 0.4,
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'transparent',
        }}
      />
    )
  }

  const THEME_CYCLE: Record<string, string> = {
    system: 'light',
    light: 'dark',
    dark: 'system',
  }
  const THEME_LABEL: Record<string, string> = {
    system: 'Auto',
    light: 'Light',
    dark: 'Dark',
  }
  const cycle = () => {
    setTheme(THEME_CYCLE[theme ?? 'system'] ?? 'system')
  }

  const label = THEME_LABEL[theme ?? 'system'] ?? 'Auto'
  const icon = resolvedTheme === 'dark' ? '○' : '●'

  return (
    <button
      aria-label={`Theme: ${label} (click to cycle)`}
      onClick={cycle}
      style={{
        width: 32,
        height: 32,
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--bg-muted)',
        color: 'var(--fg)',
        cursor: 'pointer',
        fontSize: '0.85rem',
      }}
      title={`Theme: ${label}`}
    >
      {icon}
    </button>
  )
}
