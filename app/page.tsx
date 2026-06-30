'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import CompaniesTab from '@/components/CompaniesTab'
import TasksTab from '@/components/TasksTab'
import TaxTab from '@/components/TaxTab'
import ReportsTab from '@/components/ReportsTab'

type Tab = 'companies' | 'tasks' | 'tax' | 'reports'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('companies')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[13px] text-[#888780]">Загрузка...</div>
      </div>
    )
  }
  if (!session) return null

  const user = session.user as any
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'companies', label: 'Компании',       icon: '🏢' },
    { id: 'tasks',     label: 'Задачи',          icon: '✅' },
    { id: 'tax',       label: 'Налоги до 25-го', icon: '💰' },
    { id: 'reports',   label: 'Отчётность',      icon: '📋' },
  ]

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-4">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#e0dfd6]">
        <span className="text-[#185fa5] text-lg">🏢</span>
        <h1 className="text-[15px] font-medium">CRM Аутсорс 2026</h1>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-[#185fa5] font-medium">👤 {user?.name}</span>
          <span className="text-[11px] text-[#888780] hidden sm:inline">{today}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-[10px] px-2 py-1 border border-[#d3d1c7] rounded bg-white text-[#888780] hover:text-[#1a1a18] transition"
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap mb-4 pb-3 border-b border-[#e0dfd6]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md border text-[12px] transition-all ${
              tab === t.id
                ? 'bg-[#e6f1fb] text-[#185fa5] border-transparent font-medium'
                : 'bg-white text-[#5f5e5a] border-[#d3d1c7] hover:bg-[#f5f5f0]'
            }`}
          >
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === 'companies' && <CompaniesTab />}
      {tab === 'tasks'     && <TasksTab userId={user?.id} userName={user?.name} />}
      {tab === 'tax'       && <TaxTab />}
      {tab === 'reports'   && <ReportsTab />}
    </div>
  )
}
