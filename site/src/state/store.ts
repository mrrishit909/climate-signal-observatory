import { useSyncExternalStore } from "react";

/** A tiny external store: plain state + subscribe, read by the director every frame and by React via the hook. */
export function createStore<T extends object>(init: T) {
  let state = init;
  const listeners = new Set<() => void>();
  const get = () => state;
  const set = (p: Partial<T>) => {
    const next = { ...state, ...p };
    if ((Object.keys(p) as (keyof T)[]).every((k) => Object.is(next[k], state[k]))) return;
    state = next;
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => { listeners.add(l); return () => void listeners.delete(l); };
  const use = () => useSyncExternalStore(subscribe, get, get);
  return { get, set, subscribe, use, reset: () => set(init) };
}
