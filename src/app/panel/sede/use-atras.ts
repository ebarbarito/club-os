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

// Botón "Inicio" del encabezado: antes de volver a la portada le pregunta a
// la pantalla actual (alta o pedidos) si se puede salir sin perder datos.
let guardiaActual: (() => boolean) | null = null;

export function puedeSalir(): boolean {
  return guardiaActual ? guardiaActual() : true;
}

export function useGuardiaSalida(puede: () => boolean) {
  const ref = useRef(puede);
  ref.current = puede;
  useEffect(() => {
    const fn = () => ref.current();
    guardiaActual = fn;
    return () => {
      if (guardiaActual === fn) guardiaActual = null;
    };
  }, []);
}
