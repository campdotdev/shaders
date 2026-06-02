---
"@lovo/matter": minor
"@lovo/matter-react": minor
---

Rename public API symbols to domain-accurate names.

New primary names: `FrameScheduler`, `GpuRenderer`, `GpuBackend` (`@lovo/matter`); `ShaderScene`, `ShaderSceneProps`, `ShaderContext`, `ShaderContextValue`, `useShaderContext`, `ShaderMonitor`, `ShaderMonitorProps`, `AnimatableSignal` (`@lovo/matter-react`).

Old names (`MatterScheduler`, `MatterRenderer`, `MatterBackend`, `MatterScene`, `MatterSceneProps`, `MatterContext`, `MatterContextValue`, `useMatterContext`, `MatterMonitor`, `MatterMonitorProps`, `MatterSignal`, `MatterBackend`) are deprecated with `@deprecated` JSDoc and continue to work. They will be removed no earlier than 0.5.0.

**Migration:** Replace old names with new in your imports and JSX. A one-pass find-and-replace is sufficient — no behavioral changes.
