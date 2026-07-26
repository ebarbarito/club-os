'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { checkMemberStatus } from '@/lib/public/actions';

const CART_KEY = 'club_os_cart_v1';
const MEMBER_KEY = 'club_os_member_v1';

export type CartLine = { strainId: string; name: string; pricePerGram: number; grams: number };

type MemberState = { id: string; status: 'pending' | 'valid' | 'rejected'; name: string } | null;

type StoreValue = {
  cart: CartLine[];
  addToCart: (line: Omit<CartLine, 'grams'>, grams: number) => void;
  removeFromCart: (strainId: string) => void;
  setGrams: (strainId: string, grams: number) => void;
  clearCart: () => void;
  member: MemberState;
  setMemberId: (id: string) => void;
  refreshMember: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>');
  return ctx;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [member, setMember] = useState<MemberState>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Igual que en AgeGate: lectura de localStorage solo posible post-mount.
    try {
      const rawCart = localStorage.getItem(CART_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (rawCart) setCart(JSON.parse(rawCart));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, loaded]);

  const refreshMember = useCallback(() => {
    const id = localStorage.getItem(MEMBER_KEY);
    if (!id) return;
    checkMemberStatus(id).then((res) => {
      if (res) setMember({ id, status: res.status, name: res.name });
    });
  }, []);

  useEffect(() => {
    refreshMember();
  }, [refreshMember]);

  function addToCart(line: Omit<CartLine, 'grams'>, grams: number) {
    setCart((prev) => {
      const existing = prev.find((l) => l.strainId === line.strainId);
      if (existing) {
        return prev.map((l) => (l.strainId === line.strainId ? { ...l, grams: l.grams + grams } : l));
      }
      return [...prev, { ...line, grams }];
    });
  }

  function removeFromCart(strainId: string) {
    setCart((prev) => prev.filter((l) => l.strainId !== strainId));
  }

  function setGrams(strainId: string, grams: number) {
    setCart((prev) => prev.map((l) => (l.strainId === strainId ? { ...l, grams } : l)));
  }

  function clearCart() {
    setCart([]);
  }

  function setMemberId(id: string) {
    localStorage.setItem(MEMBER_KEY, id);
    refreshMember();
  }

  return (
    <StoreContext.Provider
      value={{ cart, addToCart, removeFromCart, setGrams, clearCart, member, setMemberId, refreshMember }}
    >
      {children}
    </StoreContext.Provider>
  );
}
