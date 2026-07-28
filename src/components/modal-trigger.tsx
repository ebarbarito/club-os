'use client';

import { createContext, useContext, useState } from 'react';

// Context en vez de render-prop: children puede venir de un Server
// Component (ej. <ModalTrigger><SomeForm /></ModalTrigger>), y una función
// como children no es serializable a través del límite Server/Client
// Component. Los forms toman `close()` de este context en vez de un prop.
const ModalCloseContext = createContext<() => void>(() => {});

export function useModalClose() {
  return useContext(ModalCloseContext);
}

export function ModalTrigger({
  label,
  className,
  title,
  children,
}: {
  label: string;
  className?: string;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className={className ?? 'rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2'}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={close}
        >
          <div
            className="bg-surface rounded-xl max-w-lg w-full my-auto max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
              <h2 className="font-display text-lg font-bold text-text">{title}</h2>
              <button type="button" onClick={close} className="text-text-mute hover:text-text" aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="px-6 pb-6 overflow-y-auto">
              <ModalCloseContext.Provider value={close}>{children}</ModalCloseContext.Provider>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
