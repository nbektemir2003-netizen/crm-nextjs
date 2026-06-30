'use client'
import { useEffect, useState } from 'react'

export default function ReportsTab() {
  const [stats, setStats] = useState({ companies: 0, tasks: 0, tasksDone: 0, taxesPaid: 0, taxesTotal: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [companies, tasks, taxes] = await Promise.all([
        fetch('/api/companies').then(r => r.json()),
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/taxes').then(r => r.json()),
      ])
      setStats({
        companies: companies.length,
        tasks: tasks.length,
        tasksDone: tasks.filter((t: any) => t.status === 'done').length,
        taxesPaid: taxes.filter((t: any) => t.paid).length,
        taxesTotal: taxes.length,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-[13px] text-[#888780]">Загрузка...</div>

  const cards = [
    { label: 'Компании', value: stats.companies, icon: '🏢', color: 'bg-blue-50 border-blue-200' },
    { label: 'Задачи всего', value: stats.tasks, icon: '✅', color: 'bg-purple-50 border-purple-200' },
    { label: 'Задачи выполнены', value: stats.tasksDone, icon: '✔️', color: 'bg-green-50 border-green-200' },
    { label: 'Налоги оплачены', value: `${stats.taxesPaid} / ${stats.taxesTotal}`, icon: '💰', color: 'bg-yellow-50 border-yellow-200' },
  ]

  return (
    <div>
      <h2 className="text-[14px] font-medium mb-4">📋 Отчётность</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {cards.map(c => (
          <div key={c.label} className={`border rounded-xl p-4 ${c.color}`}>
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-[22px] font-semibold text-[#1a1a18]">{c.value}</div>
            <div className="text-[11px] text-[#888780]">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-[#e0dfd6] rounded-xl p-4">
        <p className="text-[13px] text-[#888780]">
          Выполнение задач: <strong>{stats.tasks > 0 ? Math.round((stats.tasksDone / stats.tasks) * 100) : 0}%</strong>
        </p>
        <div className="mt-2 h-2 bg-[#f0efe8] rounded-full overflow-hidden">
          <div className="h-full bg-[#185fa5] rounded-full transition-all"
            style={{ width: `${stats.tasks > 0 ? (stats.tasksDone / stats.tasks) * 100 : 0}%` }} />
        </div>
      </div>
    </div>
  )
}
