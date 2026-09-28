// Minimal store: the engine state is mutable; components subscribe to a version counter.
import { useSyncExternalStore } from 'react';

let version = 0;
const listeners = new Set();

export function refresh() {
  version++;
  for (const l of listeners) l();
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useVersion() {
  return useSyncExternalStore(subscribe, () => version);
}
