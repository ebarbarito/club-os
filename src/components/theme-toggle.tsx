'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'club-os-theme';
let listeners: Array<() => void> = [];

// document.documentElement es la fuente de verdad (ya la setea el script
// anti-flash del layout antes del primer render) — useSyncExternalStore
// evita el mismatch SSR/cliente sin necesitar un efecto que haga setState.
function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
function getSnapshot() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
function getServerSnapshot() {
  return false;
}
function setTheme(dark: boolean) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  try {
    localStorage.setItem(KEY, dark ? 'dark' : 'light');
  } catch {
    // localStorage puede no estar disponible (modo privado) — el toggle
    // igual funciona para la sesión actual, solo no persiste.
  }
  listeners.forEach((l) => l());
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button type="button" onClick={() => setTheme(!dark)} className="text-xs text-white/70 hover:text-white underline">
      {dark ? '☀ Modo claro' : '🌙 Modo oscuro'}
    </button>
  );
}
