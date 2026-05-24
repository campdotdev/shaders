'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Avoid hydration mismatch — render a stable placeholder until mounted
  // (theme is unknown on the server).
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

  const cycle = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
  }

  const label = theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'
  const icon = resolvedTheme === 'dark' ? '○' : '●'

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${label} (click to cycle)`}
      title={`Theme: ${label}`}
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
    >
      {icon}
    </button>
  )
}
