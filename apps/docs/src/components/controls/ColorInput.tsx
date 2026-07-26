'use client';

/**
 * Client-only entry point for the color popover (see ColorInputPanel for the
 * actual UI). The real implementation imports oklch.ts, which calls into
 * `@lovo/matter` for color math — that package bundles the WebGPU renderer in
 * the same module, which reads the browser-only `self` global at load time
 * and throws during any server render that reaches it. `next/dynamic` with
 * `ssr: false` keeps that whole chain out of the server bundle entirely, so
 * pages that import this barrel for unrelated controls (sliders, selects)
 * never touch it.
 */
import dynamic from 'next/dynamic';

export const ColorInput = dynamic(
  () => import('./ColorInputPanel').then((module) => module.ColorInput),
  { ssr: false },
);
