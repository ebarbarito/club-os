'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          name="username"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-line-2 px-3 py-2 mb-4 outline-none focus:border-accent"
        />

        <label className="block text-sm font-medium text-text mb-1" htmlFor="password">
          Contraseña
        </label>
        <div className="relative mb-4">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line-2 px-3 py-2 pr-10 outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-text-mute hover:text-text"
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.6A9.77 9.77 0 0112 4.5c5 0 9 3.5 10 7.5-.36 1.44-1.05 2.76-2 3.87M6.6 6.6C4.6 8 3.24 9.9 2 12c1 4 5 7.5 10 7.5 1.13 0 2.2-.18 3.2-.5" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7.5 10-7.5S22 12 22 12s-3.5 7.5-10 7.5S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

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
