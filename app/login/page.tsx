'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError('Неверный email или пароль')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
        <h1 className="text-[18px] font-semibold text-[#1a1a18] mb-6 text-center">
          🏢 CRM Аутсорс 2026
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[12px] text-[#888780] mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-[#d3d1c7] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#185fa5]"
              placeholder="admin@crm.kz"
              required
            />
          </div>
          <div>
            <label className="text-[12px] text-[#888780] mb-1 block">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-[#d3d1c7] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#185fa5]"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-[#185fa5] text-white rounded-lg py-2 text-[13px] font-medium hover:bg-[#1450a3] transition disabled:opacity-60"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
