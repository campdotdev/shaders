'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ResolvedNavGroup, ResolvedNavItem } from '@/content/types'

function NavItemLink({ item, pathname }: { item: ResolvedNavItem; pathname: string }) {
  const active = item.url === pathname
  return (
    <li>
      <Link
        href={item.url}
        style={{
          display: 'block',
          padding: '0.3rem 0.5rem',
          borderRadius: '0.25rem',
          color: active ? 'var(--fg)' : 'var(--fg-muted)',
          background: active ? 'var(--bg-muted)' : 'transparent',
          fontWeight: active ? 600 : 400,
          fontSize: '0.875rem',
          textDecoration: 'none',
        }}
      >
        {item.label}
      </Link>
    </li>
  )
}

function NavGroupBlock({
  group,
  pathname,
  depth = 0,
}: {
  group: ResolvedNavGroup
  pathname: string
  depth?: number
}) {
  return (
    <div
      style={{
        marginBottom: '1.25rem',
        paddingLeft: depth === 0 ? 0 : '0.5rem',
        borderLeft: depth === 0 ? 'none' : '1px solid var(--border)',
      }}
    >
      <div
        style={{
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--fg-muted)',
          padding: '0.25rem 0.5rem',
          fontWeight: 600,
        }}
      >
        {group.label}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {group.items.map((item, i) =>
          'items' in item ? (
            <li key={`g-${i}`} style={{ marginTop: '0.5rem' }}>
              <NavGroupBlock group={item} pathname={pathname} depth={depth + 1} />
            </li>
          ) : (
            <NavItemLink key={item.url} item={item} pathname={pathname} />
          ),
        )}
      </ul>
    </div>
  )
}

export function DocsSidebar({ tree }: { tree: ResolvedNavGroup[] }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Docs"
      data-pagefind-ignore="all"
      style={{
        position: 'sticky',
        top: '4rem',
        alignSelf: 'start',
        maxHeight: 'calc(100vh - 5rem)',
        overflowY: 'auto',
        paddingRight: '1rem',
        fontSize: '0.875rem',
      }}
    >
      {tree.map((group) => (
        <NavGroupBlock key={group.label} group={group} pathname={pathname} />
      ))}
    </nav>
  )
}
