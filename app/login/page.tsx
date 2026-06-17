'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Incorrect password');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F2] dot-grid flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#1F4D3A] flex items-center justify-center">
            <LayoutDashboard size={18} className="text-white" />
          </div>
          <span className="text-[20px] font-bold text-[#16181A] tracking-tight">TrendForge</span>
        </div>

        <div className="bg-white rounded-[20px] p-8 border border-[#E8E9E6] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 mb-6">
            <Lock size={16} className="text-[#A9AEA4]" />
            <h1 className="text-[16px] font-semibold text-[#16181A]">Enter password to continue</h1>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Password"
              autoFocus
              className="h-11 px-4 rounded-xl bg-[#F3F4F2] border border-[#E8E9E6] text-[14px] text-[#16181A] placeholder-[#A9AEA4] focus:outline-none focus:border-[#2E6B4F]/50 focus:ring-2 focus:ring-[#2E6B4F]/10 transition-colors"
            />
            {error && <p className="text-[13px] text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="h-11 rounded-xl bg-[#1F4D3A] hover:bg-[#183D2E] disabled:opacity-40 text-white text-[14px] font-semibold transition-colors"
            >
              {loading ? 'Checking…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
