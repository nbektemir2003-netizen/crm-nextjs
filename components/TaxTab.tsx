'use client'
import { useEffect, useState } from 'react'

type Tax = { id: string; name: string; amount?: number; dueDate: string; paid: boolean; company?: { name: string } }

export default function TaxTab() {
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', dueDate: '' })

  async function load() {
    const res = await fetch('/api/taxes')
    setTaxes(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/taxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, amount: form.amount ? parseFloat(form.amount) : null, dueDate: new Date(form.dueDate).toISOString() }),
    })
    setForm({ name: '', amount: '', dueDate: '' })
    setShowForm(false)
    load()
  }

  async function togglePaid(id: string, paid: boolean) {
    await fetch('/api/taxes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, paid: !paid, paidDate: !paid ? new Date().toISOString() : null }),
    })
    load()
  }

  if (loading) return <div className="text-[13px] text-[#888780]">Загрузка...</div>

  const unpaid = taxes.filter(t => !t.paid)
  const paid = taxes.filter(t => t.paid)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-medium">Налоговые платежи</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-[12px] px-3 py-1.5 bg-[#185fa5] text-white rounded-lg hover:bg-[#1450a3] transition">
          ➕ Добавить
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-[#e0dfd6] rounded-xl p-4 mb-4 flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-[#888780] mb-1 block">Название платежа *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
              placeholder="ИПН, НДС, СН..."
              className="w-full border border-[#d3d1c7] rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#185fa5]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#888780] mb-1 block">Сумма (тг)</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                className="w-full border border-[#d3d1c7] rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#185fa5]" />
            </div>
            <div>
              <label className="text-[11px] text-[#888780] mb-1 block">Срок *</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} required
                className="w-full border border-[#d3d1c7] rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#185fa5]" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-[12px] px-3 py-1.5 border border-[#d3d1c7] rounded-lg text-[#888780] hover:bg-[#f5f5f0] transition">Отмена</button>
            <button type="submit" className="text-[12px] px-3 py-1.5 bg-[#185fa5] text-white rounded-lg hover:bg-[#1450a3] transition">Сохранить</button>
          </div>
        </form>
      )}

      {unpaid.length > 0 && (
        <>
          <h3 className="text-[12px] font-medium text-[#a32d2d] mb-2">⚠️ Не оплачено ({unpaid.length})</h3>
          <div className="grid gap-2 mb-4">
            {unpaid.map(t => (
              <div key={t.id} className="bg-white border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[13px] font-medium">{t.name}</p>
                  <p className="text-[11px] text-[#888780]">📅 до {new Date(t.dueDate).toLocaleDateString('ru-RU')}{t.amount ? ` · ${t.amount.toLocaleString('ru-RU')} тг` : ''}</p>
                </div>
                <button onClick={() => togglePaid(t.id, t.paid)} className="text-[11px] px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition">
                  Оплачено
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {paid.length > 0 && (
        <>
          <h3 className="text-[12px] font-medium text-green-700 mb-2">✅ Оплачено ({paid.length})</h3>
          <div className="grid gap-2">
            {paid.map(t => (
              <div key={t.id} className="bg-white border border-green-100 rounded-xl px-4 py-3 flex items-center gap-3 opacity-70">
                <div className="flex-1">
                  <p className="text-[13px] font-medium line-through text-[#888780]">{t.name}</p>
                  <p className="text-[11px] text-[#888780]">до {new Date(t.dueDate).toLocaleDateString('ru-RU')}</p>
                </div>
                <button onClick={() => togglePaid(t.id, t.paid)} className="text-[11px] px-3 py-1 border border-[#d3d1c7] rounded-full text-[#888780] hover:bg-[#f5f5f0] transition">
                  Отменить
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {taxes.length === 0 && <p className="text-[13px] text-[#888780]">Нет платежей.</p>}
    </div>
  )
}
