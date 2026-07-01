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
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      {/* Левая часть — брендинг */}
      <div style={{
        flex: 1,
        background: '#1e293b',
        padding: '48px 40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
            <div style={{
              width: 36, height: 36, background: '#6366f1', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 18, fontWeight: 700,
            }}>B</div>
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>BuhDesk</span>
          </div>

          <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 600, lineHeight: 1.3, margin: '0 0 14px' }}>
            Управление бухгалтерией<br />в одном месте
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Компании, задачи, налоги и отчёты —<br />всё под контролем
          </p>
        </div>

        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
            {['Учёт 85+ компаний', 'Контроль налогов до 25-го', 'Отчётность по кварталам', 'Командные задачи'].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#6366f1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ color: '#cbd5e1', fontSize: 13 }}>{item}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #334155', paddingTop: 20 }}>
            <p style={{ color: '#475569', fontSize: 12, margin: 0 }}>
              BuhDesk · Бухгалтерский аутсорсинг · 2026
            </p>
          </div>
        </div>
      </div>

      {/* Правая часть — форма */}
      <div style={{
        flex: 1,
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>
              Вход в систему
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              Введите ваши данные для входа
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@buhdesk.kz"
                required
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff',
                  color: '#0f172a', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color .15s',
                }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff',
                  color: '#0f172a', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color .15s',
                }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {error && (
              <div style={{
                background: '#fee2e2', color: '#991b1b', fontSize: 13,
                padding: '10px 12px', borderRadius: 8, border: '1px solid #fecaca',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '11px 16px', background: loading ? '#a5b4fc' : '#6366f1',
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
                fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background .15s', marginTop: 4,
              }}
            >
              {loading ? 'Входим...' : 'Войти →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
