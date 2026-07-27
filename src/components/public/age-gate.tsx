'use client';

import { useEffect, useState } from 'react';

const KEY = 'club_os_age_ok_v1';

export function AgeGate({ clubName }: { clubName: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // localStorage no existe en SSR — este chequeo solo puede correr
    // post-mount en el cliente, no es una derivación de props/estado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem(KEY) !== 'yes') setShow(true);
  }, []);

  function confirm() {
    localStorage.setItem(KEY, 'yes');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-green-900 flex items-center justify-center p-4">
      <div className="max-w-sm text-center text-white">
        <h1 className="font-display text-2xl font-bold mb-3">{clubName}</h1>
        <p className="text-white/80 mb-6">
          Este sitio contiene información sobre cannabis destinada exclusivamente a mayores de 18 años.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={confirm} className="rounded-lg bg-gold text-green-900 px-5 py-2 font-semibold">
            Sí, soy mayor de 18
          </button>
          <a href="https://www.google.com" className="rounded-lg border border-white/30 px-5 py-2 font-semibold hover:border-gold hover:text-gold">
            Salir
          </a>
        </div>
      </div>
    </div>
  );
}
