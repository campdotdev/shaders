// The poster pipeline's in-browser half: the page that actually runs the
// user's component. It imports the user's module (path baked in by
// bundle.ts), mounts the requested export under a React root, freezes the
// animation clock for a deterministic capture, and installs the readiness
// watcher the screenshot side polls for.
import type React from 'react';

import { setReducedMotionPolicy } from '@camp-dev/shaders';
import { createRoot } from 'react-dom/client';

import { installFrameReadyWatcher } from './frameReady.js';

// Replaced at build time by esbuild's `define`:
declare const __SHADERS_USER_MODULE_PATH: string;
declare const __SHADERS_EXPORT_NAME: string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isReactComponent(value: unknown): value is React.ComponentType<unknown> {
  return typeof value === 'function';
}

const rawModule: unknown = await import(/* @vite-ignore */ __SHADERS_USER_MODULE_PATH);
const userModule: Record<string, unknown> = isRecord(rawModule) ? rawModule : {};

const rawExport: unknown = userModule[__SHADERS_EXPORT_NAME];

if (!isReactComponent(rawExport)) {
  document.body.innerHTML = `<pre style="color:#fff;padding:1rem">shaders poster: export "${__SHADERS_EXPORT_NAME}" is not a React component (got ${typeof rawExport}). Available exports: ${Object.keys(
    userModule,
  ).join(', ')}</pre>`;
  throw new Error(`export "${__SHADERS_EXPORT_NAME}" is not a component`);
}

const Component = rawExport;

const rootEl = document.getElementById('root');

if (!rootEl) throw new Error('shaders poster: #root missing from harness HTML');

const root = createRoot(rootEl);

// Pin the animation clock so the poster captures a deterministic t=0 frame,
// matching what users see at mount (ShaderScene also resets to t=0 at first
// paint). 'paused' sets the reduced-motion time scale to 0, so elapsedTime
// stays 0 regardless of how many settle frames elapse before the screenshot.
setReducedMotionPolicy('paused');

root.render(<Component />);

installFrameReadyWatcher();
