'use client'
import { useEffect, useState } from 'react'

type Company = {
  id: string; name: string; bin?: string; phone?: string
  email?: string; director?: string; notes?: string
}

export default function CompaniesTab() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', bin: '', phone: '', email: '', director: '', notes: '' })

  async function load() {
    const res = await fetch('/api/companies')
    setCompanies(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setForm({ name: '', bin: '', phone: '', email: '', director: '', notes: '' })
    setShowForm(false)
    load()
  }

  if (loading) return <div className="text-[13px] text-[#888780]">Загрузка...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-medium">Компании ({companies.length})</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-[12px] px-3 py-1.5 bg-[#185fa5] text-white rounded-lg hover:bg-[#1450a3] transition">
          ➕ Добавить
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-[#e0dfd6] rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
          {(['name', 'bin', 'phone', 'email', 'director'] as const).map(f => (
            <div key={f}>
              <label className="text-[11px] text-[#888780] mb-1 block capitalize">{
                f === 'name' ? 'Название *' : f === 'bin' ? 'БИН' : f === 'phone' ? 'Телефон' : f === 'email' ? 'Email' : 'Директор'
              }</label>
              <input
                value={form[f]}
                onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                required={f === 'name'}
                className="w-full border border-[#d3d1c7] rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#185fa5]"
              />
            </div>
          ))}
          <div className="col-span-2">
            <label className="text-[11px] text-[#888780] mb-1 block">Заметки</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full border border-[#d3d1c7] rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#185fa5] resize-none" rows={2} />
          </div>
          <div className="col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-[12px] px-3 py-1.5 border border-[#d3d1c7] rounded-lg text-[#888780] hover:bg-[#f5f5f0] transition">Отмена</button>
            <button type="submit" className="text-[12px] px-3 py-1.5 bg-[#185fa5] text-white rounded-lg hover:bg-[#1450a3] transition">Сохранить</button>
          </div>
        </form>
      )}

      <div className="grid gap-2">
        {companies.length === 0 && <p className="text-[13px] text-[#888780]">Нет компаний. Добавьте первую.</p>}
        {companies.map(c => (
          <div key={c.id} className="bg-white border border-[#e0dfd6] rounded-xl px-4 py-3 flex flex-wrap gap-4 items-start">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#1a1a18]">{c.name}</p>
              {c.bin && <p className="text-[11px] text-[#888780]">БИН: {c.bin}</p>}
            </div>
            <div className="flex gap-4 flex-wrap text-[11px] text-[#888780]">
              {c.director && <span>👤 {c.director}</span>}
              {c.phone && <span>📞 {c.phone}</span>}
              {c.email && <span>✉️ {c.email}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
