"use client";

import { useSyncExternalStore } from 'react';

// Standalone adapter for overlay-site's provider-backed reduced-motion hook.
const query = '(prefers-reduced-motion: reduce)';
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
export function useReducedMotion() {
  return useSyncExternalStore(subscribe,
    () => window.matchMedia(query).matches,
    () => false);
}
