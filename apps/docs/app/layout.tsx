import type { ReactNode } from 'react'

export const metadata = {
  title: 'Matter — React shader components',
  description: 'WebGPU + TSL shader components for React.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          background: '#0e0e1a',
          color: '#e0e0f0',
        }}
      >
        {children}
      </body>
    </html>
  )
}
