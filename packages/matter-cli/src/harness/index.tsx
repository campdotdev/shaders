import type React from 'react'
import { createRoot } from 'react-dom/client'

import { installFrameReadyWatcher } from './frameReady.js'

// Replaced at build time by esbuild's `define`:
declare const __MATTER_USER_MODULE_PATH: string
declare const __MATTER_EXPORT_NAME: string

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

// Dynamic import returns `any`; assign to `unknown` first via explicit typing.
const rawModule: unknown = await import(/* @vite-ignore */ __MATTER_USER_MODULE_PATH)
const userModule: Record<string, unknown> = isRecord(rawModule) ? rawModule : {}

const rawExport: unknown = userModule[__MATTER_EXPORT_NAME]

if (typeof rawExport !== 'function') {
  document.body.innerHTML = `<pre style="color:#fff;padding:1rem">matter poster: export "${__MATTER_EXPORT_NAME}" is not a React component (got ${typeof rawExport}). Available exports: ${Object.keys(
    userModule,
  ).join(', ')}</pre>`
  throw new Error(`export "${__MATTER_EXPORT_NAME}" is not a component`)
}

// After the typeof guard above, rawExport is a function — safe to use as a React component.
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
const Component = rawExport as React.ComponentType<unknown>

const rootEl = document.getElementById('root')

if (!rootEl) throw new Error('matter poster: #root missing from harness HTML')

const root = createRoot(rootEl)

root.render(<Component />)

installFrameReadyWatcher()
