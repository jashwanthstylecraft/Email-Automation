'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Wand2, Mail, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, fetchSession } = useStore();
  const [email, setEmail] = useState('jashwanthd@stylecraftus.com');
  const [password, setPassword] = useState('StyleCraft@123');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSession().then(() => {
      if (useStore.getState().user) {
        router.push('/dashboard');
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        useStore.setState({ user: data.user });
        router.push('/dashboard');
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err: any) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-bg bg-grid-pattern text-text-primary px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm flex flex-col items-center">
        <div className="flex items-center gap-2 p-3 bg-accent-bg rounded-xl border border-accent-border mb-4 animate-pulse">
          <Wand2 className="w-8 h-8 text-accent-text" />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-text-primary font-sans uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent-text to-accent">
          StyleCraft
        </h2>
        <p className="text-center text-sm font-semibold text-text-secondary mt-1">
          Intelligent Email Automation
        </p>
        <p className="mt-2 text-center text-xs text-text-secondary">
          Demo Credentials Seeded: <span className="font-mono text-accent-text">jashwanthd@stylecraftus.com / StyleCraft@123</span>
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-panel p-8 rounded-2xl border border-border shadow-2xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 text-xs bg-danger-bg border border-danger/25 text-danger rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Email address
              </label>
              <div className="mt-2 relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-text-muted" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg bg-surface-3 border border-border px-10 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="mt-2 relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-text-muted" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg bg-surface-3 border border-border px-10 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center items-center gap-2 rounded-lg bg-accent hover:bg-accent-hover px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
