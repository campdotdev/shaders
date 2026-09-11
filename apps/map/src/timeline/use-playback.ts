// React's view of the playback store. useSyncExternalStore re-renders the
// caller only when the snapshot object changes, and the store replaces that
// object only on a step change or a control change, never on a clock tick.
import { useSyncExternalStore } from 'react';

import { getPlaybackSnapshot, type PlaybackSnapshot, subscribePlayback } from './store';

export function usePlayback(): PlaybackSnapshot {
  return useSyncExternalStore(subscribePlayback, getPlaybackSnapshot, getPlaybackSnapshot);
}
