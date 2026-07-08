---
"@lovo/matter-react": major
---

Remove `ShaderScene`'s `fallback` prop (breaking). Use the new `ShaderPoster` component from `@lovo/matter-react/poster` instead — it renders in the initial HTML (SSR-safe, no three import) and dismisses when the wrapped `ShaderScene` paints its first frame.
