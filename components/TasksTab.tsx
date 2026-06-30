'use client'
import { useEffect, useState } from 'react'

type Task = { id: string; title: string; description?: string; status: string; dueDate?: string; company?: { name: string } }

const STATUS_LABELS: Record<string, string> = { pending: 'Ожидает', in_progress: 'В работе', done: 'Готово' }
const STATUS_COLORS: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', in_progress: 'bg-blue-100 text-blue-700', done: 'bg-green-100 text-green-700' }

export default function TasksTab({ userId, userName }: { userId: string; userName: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', dueDate: '' })

  async function load() {
    const res = await fetch('/api/tasks')
    setTasks(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, userId, dueDate: form.dueDate || null }),
    })
    setForm({ title: '', description: '', dueDate: '' })
    setShowForm(false)
    load()
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    load()
  }

  if (loading) return <div className="text-[13px] text-[#888780]">Загрузка...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-medium">Задачи ({tasks.length})</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-[12px] px-3 py-1.5 bg-[#185fa5] text-white rounded-lg hover:bg-[#1450a3] transition">
          ➕ Добавить
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-[#e0dfd6] rounded-xl p-4 mb-4 flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-[#888780] mb-1 block">Задача *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required
              className="w-full border border-[#d3d1c7] rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#185fa5]" />
          </div>
          <div>
            <label className="text-[11px] text-[#888780] mb-1 block">Описание</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full border border-[#d3d1c7] rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#185fa5] resize-none" rows={2} />
          </div>
          <div>
            <label className="text-[11px] text-[#888780] mb-1 block">Срок</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
              className="border border-[#d3d1c7] rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#185fa5]" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-[12px] px-3 py-1.5 border border-[#d3d1c7] rounded-lg text-[#888780] hover:bg-[#f5f5f0] transition">Отмена</button>
            <button type="submit" className="text-[12px] px-3 py-1.5 bg-[#185fa5] text-white rounded-lg hover:bg-[#1450a3] transition">Сохранить</button>
          </div>
        </form>
      )}

      <div className="grid gap-2">
        {tasks.length === 0 && <p className="text-[13px] text-[#888780]">Нет задач.</p>}
        {tasks.map(t => (
          <div key={t.id} className="bg-white border border-[#e0dfd6] rounded-xl px-4 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium">{t.title}</p>
              {t.description && <p className="text-[11px] text-[#888780] mt-0.5">{t.description}</p>}
              {t.dueDate && <p className="text-[11px] text-[#888780] mt-0.5">📅 {new Date(t.dueDate).toLocaleDateString('ru-RU')}</p>}
              {t.company && <p className="text-[11px] text-[#888780]">🏢 {t.company.name}</p>}
            </div>
            <select value={t.status} onChange={e => updateStatus(t.id, e.target.value)}
              className={`text-[11px] px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${STATUS_COLORS[t.status]}`}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
