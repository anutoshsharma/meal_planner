'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/login`;

    if (isRegister) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
      setMessage('Registration successful. Please check your email to confirm.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Sign {isRegister ? 'up' : 'in'}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Use your email and password to access your personal meal planner.
      </p>

      {message && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
        >
          {loading ? 'Working…' : isRegister ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <div className="mt-5 text-sm text-slate-500">
        <button
          type="button"
          onClick={() => setIsRegister(prev => !prev)}
          className="text-slate-900 underline-offset-4 hover:text-slate-700"
        >
          {isRegister ? 'Already have an account?' : 'Create a new account'}
        </button>
      </div>
    </div>
  );
}
