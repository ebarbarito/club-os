'use client';

import { useEffect, useRef } from 'react';

// Intercepta la flecha "atrás" del navegador en la tablet. Agrega una entrada
// al historial (conservando el estado de Next) y, cuando se vuelve atrás,
// llama a `alVolver`: si devuelve false es porque deja salir (y navega él);
// cualquier otra cosa vuelve a armar la trampa y la pantalla queda como está.
export function useAtras(alVolver: () => boolean | void, activo = true) {
  const ref = useRef(alVolver);
  ref.current = alVolver;
  useEffect(() => {
    if (!activo) return;
    const armar = () => window.history.pushState({ ...(window.history.state ?? {}), sedeAtras: true }, '');
    armar();
    const alPop = () => {
      if (ref.current() !== false) armar();
    };
    window.addEventListener('popstate', alPop);
    return () => window.removeEventListener('popstate', alPop);
  }, [activo]);
}
