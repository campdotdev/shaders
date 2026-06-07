declare global {
  interface Window {
    __matterReady?: boolean
  }
}

export function installFrameReadyWatcher(): void {
  // Real implementation lands in Phase 4. For now, just satisfy imports.
  // We deliberately do NOT set __matterReady here; Phase 4 owns that contract.
}
