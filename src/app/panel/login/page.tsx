'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError('Email o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    router.replace('/panel');
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-bg font-sans p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[400px] rounded-xl border border-line bg-surface p-8 shadow-sm"
      >
        <h1 className="font-display text-xl font-bold text-text mb-1">Club OS</h1>
        <p className="text-text-soft text-sm mb-6">Ingresá con tu cuenta.</p>

        <label className="block text-sm font-medium text-text mb-1" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-line-2 px-3 py-2 mb-4 outline-none focus:border-accent"
        />

        <label className="block text-sm font-medium text-text mb-1" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-line-2 px-3 py-2 mb-4 outline-none focus:border-accent"
        />

        {error && <p className="text-red text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent text-white font-semibold py-2 disabled:opacity-60"
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
