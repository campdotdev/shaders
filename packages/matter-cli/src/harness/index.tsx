import { createRoot } from 'react-dom/client'

import { installFrameReadyWatcher } from './frameReady.js'

// Replaced at build time by esbuild's `define`:
declare const __MATTER_USER_MODULE_PATH: string
declare const __MATTER_EXPORT_NAME: string

const userModule = (await import(/* @vite-ignore */ __MATTER_USER_MODULE_PATH)) as Record<
  string,
  unknown
>

const Component = userModule[__MATTER_EXPORT_NAME]

if (typeof Component !== 'function') {
  document.body.innerHTML = `<pre style="color:#fff;padding:1rem">matter poster: export "${__MATTER_EXPORT_NAME}" is not a React component (got ${typeof Component}). Available exports: ${Object.keys(
    userModule,
  ).join(', ')}</pre>`
  throw new Error(`export "${__MATTER_EXPORT_NAME}" is not a component`)
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('matter poster: #root missing from harness HTML')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C = Component as any
const root = createRoot(rootEl)
root.render(<C />)

installFrameReadyWatcher()
