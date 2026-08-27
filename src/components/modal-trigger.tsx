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

const SIZE_CLS = {
  md: 'max-w-lg',
  xl: 'max-w-4xl',
};

// Chrome del modal sin trigger propio — para cuando quien abre/cierra no es
// un botón simple (ej. una fila de tabla entera, o un flujo con más de un
// paso). ModalTrigger es la versión más común, con su propio botón.
export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: keyof typeof SIZE_CLS;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`bg-surface rounded-xl ${SIZE_CLS[size]} w-full my-auto max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
          <h2 className="font-display text-lg font-bold text-text">{title}</h2>
          <button type="button" onClick={onClose} className="text-text-mute hover:text-text" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto">
          <ModalCloseContext.Provider value={onClose}>{children}</ModalCloseContext.Provider>
        </div>
      </div>
    </div>
  );
}

export function ModalTrigger({
  label,
  className,
  title,
  size = 'md',
  children,
}: {
  label: string;
  className?: string;
  title: string;
  size?: keyof typeof SIZE_CLS;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className ?? 'rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2'}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size={size}>
        {children}
      </Modal>
    </>
  );
}
