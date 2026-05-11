'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createSupabaseBrowserClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0F172A] lg:grid lg:grid-cols-[1.15fr_0.85fr]">
      <section className="flex items-center justify-center px-6 py-12 lg:px-10">
        <div className="w-full max-w-xl text-center lg:text-left">
          <div className="mb-8 inline-flex items-center justify-center">
            <Image
              src="/brand/serenius-logo-core-white.svg"
              alt="Serenius"
              width={88}
              height={28}
              className="h-auto w-[88px] max-w-[88px] object-contain"
              priority
            />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Serenius
          </h1>
          <p className="mt-4 text-sm font-medium uppercase tracking-[0.28em] text-[#C8A96B]">
            Transparency • Stewardship • Impact
          </p>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
            Secure access to your nonprofit operating platform.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#F8F7F4] px-6 py-12 lg:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Serenius</h1>
            <p className="mt-2 text-xs uppercase tracking-[0.26em] text-stone-500">
              Transparency • Stewardship • Impact
            </p>
          </div>

          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Sign in to your account
              </h2>
              <p className="mt-2 text-sm text-stone-500">
                Use your Serenius credentials to continue.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#D8DADC] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#C8A96B] focus:outline-none focus:ring-2 focus:ring-[#C8A96B]/25"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#D8DADC] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#C8A96B] focus:outline-none focus:ring-2 focus:ring-[#C8A96B]/25"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#C8A96B] px-4 py-2.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#b8975a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Signing in…
                  </span>
                ) : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
