'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

// ─── ТИПЫ ───────────────────────────────
type Company = { id?: string; n: string; freq: string; reg: string; cat: string; b: string; risk: string; nds: boolean; status: string; skipReports: string[]; extraReports: string[] }
type Task = { id?: string; co: string; desc: string; emp: string; prio: string; date: string; st: string }
type TabId = 'co' | 'tasks' | 'tax' | 'rep' | 'add'
type SyncCls = '' | 'syncing' | 'error'

// ─── КОНСТАНТЫ ──────────────────────────
const FC: Record<string, string> = { 'Ежедневная': 'bb', 'Раз в месяц': 'bt', 'Квартальная': 'bp', 'Разовая': 'bk', 'На закрытие': 'br' }
const MN = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const MN_S = ['', 'Янв', 'Фев', 'Март', 'Апр', 'Май', 'Июнь', 'Июль', 'Авг', 'Сент', 'Окт', 'Ноя', 'Дек']
const QM: Record<string, number[]> = { '1 квартал': [1, 2, 3], '2 квартал': [4, 5, 6], '3 квартал': [7, 8, 9], '4 квартал': [10, 11, 12] }
const QTRS = [
  { q: '1 квартал', due300: '2026-05-15', due200: '2026-05-15', due910: '', has910: false },
  { q: '2 квартал', due300: '2026-08-15', due200: '2026-08-15', due910: '2026-08-15', has910: true },
  { q: '3 квартал', due300: '2026-11-15', due200: '2026-11-15', due910: '', has910: false },
  { q: '4 квартал', due300: '2027-02-15', due200: '2027-02-15', due910: '2027-02-15', has910: true },
]
const QORDER = ['1 квартал', '2 квартал', '3 квартал', '4 квартал', 'Годовой']
const QLABELS: Record<string, string> = {
  '1 квартал': '1 квартал (янв–март) · до 15 мая',
  '2 квартал': '2 квартал (апр–июнь) · до 15 авг',
  '3 квартал': '3 квартал (июль–сент) · до 15 ноя',
  '4 квартал': '4 квартал (окт–дек) · до 15 фев',
  'Годовой': 'Годовой (100/920) · до 31 марта',
}
const DEFAULT_USERS = ['Нурдаулет', 'Акмарал', 'Динара', 'Жания', 'Ұлбосын', 'Айзат']

// ─── УТИЛИТЫ ────────────────────────────
function dl(d: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  return Math.round((x.getTime() - today.getTime()) / 86400000)
}

function regBadge(r: string) {
  if (r === 'ОУР (НДС)') return <span className="b br">ОУР (НДС)</span>
  if (r === 'ОУР') return <span className="b bp">ОУР</span>
  if (r === 'УПРОЩЕНКА') return <span className="b bt">УПРОЩЕНКА</span>
  if (r === 'СНР') return <span className="b bt">СНР</span>
  if (r === 'КХ') return <span className="b bk">КХ</span>
  return <span className="b bk">{r}</span>
}

function pBadge(p: string) {
  if (p === 'Критично') return <span className="b br">{p}</span>
  if (p === 'Срочно') return <span className="b ba">{p}</span>
  return <span className="b bk">{p}</span>
}

function getTaxTypes(reg: string): string[] {
  if (reg === 'ОУР (НДС)') return ['КПН авансовый', 'ИПН/СН сотр.', 'НДС до 25-го']
  if (reg === 'ОУР') return ['КПН авансовый', 'ИПН/СН сотр.']
  if (reg === 'УПРОЩЕНКА' || reg === 'СНР') return ['ИПН за сотрудников']
  if (reg === 'КХ') return ['ЕЗН']
  return []
}

function getStatTypes(reg: string): string[] {
  if (['ОУР (НДС)', 'ОУР', 'УПРОЩЕНКА', 'СНР'].includes(reg)) return ['СО (соц. отчисления)', 'ОСМС']
  return []
}

type RepEntry = { co: string; reg: string; type: string; q: string; due: string; months: number[] | null }

function buildReports(companies: Company[]): { tax: RepEntry[]; stat: RepEntry[] } {
  const tax: RepEntry[] = [], stat: RepEntry[] = []
  for (const c of companies) {
    if (c.status !== 'Активная') continue
    const r = c.reg
    const skip = c.skipReports || []
    const extra = c.extraReports || []
    for (const qt of QTRS) {
      if (r === 'ОУР (НДС)') {
        if (!skip.includes('300.00 (НДС)')) tax.push({ co: c.n, reg: r, type: '300.00 (НДС)', q: qt.q, due: qt.due300, months: QM[qt.q] })
        if (!skip.includes('200.00 (ИПН/СН)')) tax.push({ co: c.n, reg: r, type: '200.00 (ИПН/СН)', q: qt.q, due: qt.due200, months: QM[qt.q] })
      }
      if (r === 'ОУР') {
        if (!skip.includes('200.00 (ИПН/СН)')) tax.push({ co: c.n, reg: r, type: '200.00 (ИПН/СН)', q: qt.q, due: qt.due200, months: QM[qt.q] })
      }
      if (r === 'УПРОЩЕНКА' || r === 'СНР') {
        if (!skip.includes('200.00 (ИПН сотр.)')) tax.push({ co: c.n, reg: r, type: '200.00 (ИПН сотр.)', q: qt.q, due: qt.due200, months: QM[qt.q] })
        if (qt.has910 && !skip.includes('910.00 (упрощённая)')) tax.push({ co: c.n, reg: r, type: '910.00 (упрощённая)', q: qt.q, due: qt.due910, months: null })
      }
      if (r !== 'КХ') {
        const isOUR = r === 'ОУР (НДС)' || r === 'ОУР'
        const statType = isOUR ? '1-Услуги (стат.)' : '2МП (стат.)'
        if (!skip.includes(statType)) stat.push({ co: c.n, reg: r, type: statType, q: qt.q, due: qt.due200, months: null })
      }
    }
    if ((r === 'ОУР (НДС)' || r === 'ОУР') && !skip.includes('100.00 (КПН годовой)'))
      tax.push({ co: c.n, reg: r, type: '100.00 (год. КПН)', q: 'Годовой', due: '2027-03-31', months: null })
    if (r === 'КХ' && !skip.includes('920.00 (декл. КХ)'))
      tax.push({ co: c.n, reg: r, type: '920.00 (декл. КХ)', q: 'Годовой', due: '2027-03-31', months: null })
    if (r !== 'КХ' && !skip.includes('11-МП (год. стат.)'))
      stat.push({ co: c.n, reg: r, type: '11-МП (год. стат.)', q: 'Годовой', due: '2027-02-15', months: null })
    extra.forEach(e => {
      if (skip.includes(e)) return
      const parts = e.split('|')
      const name = parts[0], period = parts[1] || 'annual', repType = parts[2] || 'tax'
      const isStat = repType === 'stat'
      if (period === 'quarterly') {
        for (const qt of QTRS) {
          if (isStat) stat.push({ co: c.n, reg: r, type: name, q: qt.q, due: qt.due200, months: null })
          else tax.push({ co: c.n, reg: r, type: name, q: qt.q, due: qt.due200, months: null })
        }
      } else if (period === 'monthly') {
        for (const qt of QTRS) {
          if (isStat) stat.push({ co: c.n, reg: r, type: name + ' (ежемес.)', q: qt.q, due: qt.due200, months: QM[qt.q] })
          else tax.push({ co: c.n, reg: r, type: name + ' (ежемес.)', q: qt.q, due: qt.due200, months: QM[qt.q] })
        }
      } else {
        if (isStat) stat.push({ co: c.n, reg: r, type: name, q: 'Годовой', due: '2027-03-31', months: null })
        else tax.push({ co: c.n, reg: r, type: name, q: 'Годовой', due: '2027-03-31', months: null })
      }
    })
  }
  return { tax, stat }
}

// ─── ГЛАВНЫЙ КОМПОНЕНТ ──────────────────
export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [tab, setTab] = useState<TabId>('co')
  const [companies, setCompanies] = useState<Company[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taxDone, setTaxDone] = useState<Record<string, boolean>>({})
  const [repDone, setRepDone] = useState<Record<string, boolean>>({})
  const [syncText, setSyncText] = useState('Загрузка...')
  const [syncCls, setSyncCls] = useState<SyncCls>('syncing')
  const [toast, setToast] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [users, setUsers] = useState<string[]>(DEFAULT_USERS)

  // Фильтры компаний
  const [coQ, setCoQ] = useState('')
  const [coFreq, setCoFreq] = useState('')
  const [coCat, setCoCat] = useState('')
  const [coReg, setCoReg] = useState('')

  // Фильтры задач
  const [taskQ, setTaskQ] = useState('')
  const [taskEmp, setTaskEmp] = useState('')
  const [taskPrio, setTaskPrio] = useState('')
  const [taskStat, setTaskStat] = useState('')

  // Фильтры налогов
  const [taxMonth, setTaxMonth] = useState(7)
  const [taxFreq, setTaxFreq] = useState('')
  const [taxSubTab, setTaxSubTab] = useState<'main' | 'stat'>('main')

  // Фильтры отчётов
  const [repQ, setRepQ] = useState('')
  const [repReg, setRepReg] = useState('')
  const [repStatus, setRepStatus] = useState('')
  const [repSubTab, setRepSubTab] = useState<'tax' | 'stat'>('tax')

  // Форма новой задачи
  const [newTaskCo, setNewTaskCo] = useState('')
  const [newTaskEmp, setNewTaskEmp] = useState(users[0] || '')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [newTaskDate, setNewTaskDate] = useState('')
  const [newTaskPrio, setNewTaskPrio] = useState('Обычный')

  // Форма новой компании
  const [newCoName, setNewCoName] = useState('')
  const [newCoBin, setNewCoBin] = useState('')
  const [newCoBinLoading, setNewCoBinLoading] = useState(false)
  const [newCoReg, setNewCoReg] = useState('')
  const [newCoFreq, setNewCoFreq] = useState('Ежедневная')
  const [newCoCat, setNewCoCat] = useState('')
  const [newCoBase, setNewCoBase] = useState('БАР')
  const [newCoRisk, setNewCoRisk] = useState('низкая')
  const [newCoNds, setNewCoNds] = useState('нет')
  const [newCoStatus, setNewCoStatus] = useState('Активная')
  const [addMsg, setAddMsg] = useState('')

  // Модалы
  const [editCoIdx, setEditCoIdx] = useState(-1)
  const [editCoData, setEditCoData] = useState<Company | null>(null)
  const [editTaskIdx, setEditTaskIdx] = useState(-1)
  const [editTaskData, setEditTaskData] = useState<Task | null>(null)
  const [showNotif, setShowNotif] = useState(false)
  const [showEditUsers, setShowEditUsers] = useState(false)
  const [newUserName, setNewUserName] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') loadData()
  }, [status])

  useEffect(() => {
    document.body.classList.remove('dark')
    const savedUsers = localStorage.getItem('crm_users')
    if (savedUsers) try { setUsers(JSON.parse(savedUsers)) } catch {}
    const td = localStorage.getItem('crm_taxDone')
    if (td) try { setTaxDone(JSON.parse(td)) } catch {}
    const rd = localStorage.getItem('crm_repDone')
    if (rd) try { setRepDone(JSON.parse(rd)) } catch {}
  }, [])

  async function loadData() {
    setSyncText('Загрузка...'); setSyncCls('syncing')
    try {
      const [coRes, taskRes] = await Promise.all([fetch('/api/companies'), fetch('/api/tasks')])
      if (coRes.ok) { const d = await coRes.json(); if (Array.isArray(d)) setCompanies(d) }
      if (taskRes.ok) { const d = await taskRes.json(); if (Array.isArray(d)) setTasks(d) }
      setSyncText('Синхронизировано ✓'); setSyncCls('')
    } catch {
      setSyncText('Офлайн режим'); setSyncCls('error')
    }
  }

  function showToast(msg: string) {
    setToast(msg); setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2500)
  }

  function saveTaxDone(td: Record<string, boolean>) {
    setTaxDone(td)
    localStorage.setItem('crm_taxDone', JSON.stringify(td))
  }
  function saveRepDone(rd: Record<string, boolean>) {
    setRepDone(rd)
    localStorage.setItem('crm_repDone', JSON.stringify(rd))
  }

  // ─── КОМПАНИИ ───────────────────────────
  const filteredCos = companies.filter(c => {
    if (coQ && !c.n.toLowerCase().includes(coQ.toLowerCase())) return false
    if (coFreq && c.freq !== coFreq) return false
    if (coCat && c.cat !== coCat) return false
    if (coReg && !c.reg.includes(coReg)) return false
    return true
  })

  async function deleteCo(co: Company) {
    if (!confirm(`Удалить "${co.n}"?`)) return
    if (co.id) {
      await fetch('/api/companies', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: co.id }) })
    }
    setCompanies(prev => prev.filter(c => c.n !== co.n))
    showToast(`"${co.n}" удалена ✓`)
  }

  async function saveCoEdit() {
    if (!editCoData) return
    setSyncText('Сохранение...'); setSyncCls('syncing')
    if (editCoData.id) {
      const res = await fetch('/api/companies', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editCoData) })
      if (res.ok) { const updated = await res.json(); setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c)) }
    }
    setEditCoIdx(-1); setEditCoData(null)
    setSyncText('Синхронизировано ✓'); setSyncCls('')
    showToast('Компания обновлена ✓')
  }

  async function deleteCoFromModal() {
    if (!editCoData) return
    if (!confirm(`Удалить "${editCoData.n}"?`)) return
    if (editCoData.id) {
      await fetch('/api/companies', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editCoData.id }) })
    }
    setCompanies(prev => prev.filter(c => c.id !== editCoData.id))
    setEditCoIdx(-1); setEditCoData(null)
    showToast(`"${editCoData.n}" удалена ✓`)
  }

  async function lookupBin() {
    const bin = newCoBin.trim()
    if (!bin || bin.length < 12) { showToast('Введите 12-значный БИН/ИИН'); return }
    setNewCoBinLoading(true)
    try {
      const res = await fetch(`/api/bin-lookup?bin=${bin}`)
      const data = await res.json()
      if (data.name) {
        setNewCoName(data.name)
        showToast(`Найдено: ${data.name}`)
      } else {
        showToast('Не найдено — введите название вручную')
      }
    } catch {
      showToast('Ошибка поиска — введите название вручную')
    } finally {
      setNewCoBinLoading(false)
    }
  }

  async function addCo() {
    if (!newCoName || !newCoReg) { alert('Заполни название и режим'); return }
    const co: Company = { n: newCoName, freq: newCoFreq, reg: newCoReg, cat: newCoCat, b: newCoBase, risk: newCoRisk, nds: newCoNds === 'да', status: newCoStatus, skipReports: [], extraReports: [] }
    setSyncText('Сохранение...'); setSyncCls('syncing')
    const res = await fetch('/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(co) })
    if (res.ok) { const saved = await res.json(); setCompanies(prev => [...prev, saved]) }
    setNewCoName('')
    setAddMsg(`✓ "${newCoName}" добавлена! Отчёты созданы по режиму ${newCoReg}.`)
    setTimeout(() => setAddMsg(''), 4000)
    setSyncText('Синхронизировано ✓'); setSyncCls('')
    showToast(`"${newCoName}" добавлена в базу ✓`)
  }

  // ─── ЗАДАЧИ ─────────────────────────────
  const filteredTasks = tasks.filter(t => {
    if (taskQ && !t.co.toLowerCase().includes(taskQ.toLowerCase()) && !t.desc.toLowerCase().includes(taskQ.toLowerCase())) return false
    if (taskEmp && t.emp !== taskEmp) return false
    if (taskPrio && t.prio !== taskPrio) return false
    if (taskStat && t.st !== taskStat) return false
    return true
  })

  async function addTask() {
    if (!newTaskCo || !newTaskDesc || !newTaskDate) { alert('Заполни компанию, описание и срок'); return }
    const task: Task = { co: newTaskCo, desc: newTaskDesc, emp: newTaskEmp, prio: newTaskPrio, date: newTaskDate, st: 'В работе' }
    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) })
    if (res.ok) { const saved = await res.json(); setTasks(prev => [saved, ...prev]) }
    setNewTaskDesc(''); setNewTaskDate('')
    showToast('Задача добавлена ✓')
  }

  async function doneTask(t: Task) {
    const updated = { ...t, st: 'Выполнено' }
    const res = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    if (res.ok) setTasks(prev => prev.map(x => x.id === t.id ? updated : x))
    showToast('Задача выполнена ✓')
  }

  async function saveTaskEdit() {
    if (!editTaskData) return
    const res = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editTaskData) })
    if (res.ok) setTasks(prev => prev.map(t => t.id === editTaskData.id ? editTaskData : t))
    setEditTaskIdx(-1); setEditTaskData(null)
    showToast('Задача обновлена ✓')
  }

  async function deleteTask() {
    if (!editTaskData) return
    if (!confirm('Удалить задачу?')) return
    if (editTaskData.id) {
      await fetch('/api/tasks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editTaskData.id }) })
    }
    setTasks(prev => prev.filter(t => t.id !== editTaskData.id))
    setEditTaskIdx(-1); setEditTaskData(null)
    showToast('Задача удалена ✓')
  }

  // ─── НАЛОГИ ─────────────────────────────
  function toggleTax(key: string) {
    const nd = { ...taxDone, [key]: !taxDone[key] }
    saveTaxDone(nd)
  }

  // ─── ОТЧЁТЫ ─────────────────────────────
  function toggleRep(key: string) {
    const nd = { ...repDone, [key]: !repDone[key] }
    saveRepDone(nd)
    showToast(nd[key] ? 'Отчёт сдан ✓' : 'Отмечено как не сданный')
  }
  function toggleMonthTax(key: string) {
    const nd = { ...taxDone, [key]: !taxDone[key] }
    saveTaxDone(nd)
  }

  // ─── ПОЛЬЗОВАТЕЛИ ───────────────────────
  function addUser() {
    if (!newUserName.trim()) return
    if (users.includes(newUserName.trim())) { alert('Такой сотрудник уже есть'); return }
    const nu = [...users, newUserName.trim()]
    setUsers(nu); localStorage.setItem('crm_users', JSON.stringify(nu))
    setNewUserName('')
  }
  function removeUser(i: number) {
    if (!confirm(`Удалить "${users[i]}"?`)) return
    const nu = users.filter((_, idx) => idx !== i)
    setUsers(nu); localStorage.setItem('crm_users', JSON.stringify(nu))
  }

  // ─── УВЕДОМЛЕНИЯ ────────────────────────
  const userName = (session?.user as any)?.name || ''
  const myTasks = tasks.filter(t => t.emp === userName && t.st === 'В работе')
  const myDone = tasks.filter(t => t.emp === userName && t.st === 'Выполнено')

  // ─── СТАТИСТИКА ─────────────────────────
  const stCo = {
    total: filteredCos.length,
    daily: filteredCos.filter(c => c.freq === 'Ежедневная').length,
    monthly: filteredCos.filter(c => c.freq === 'Раз в месяц').length,
    quarterly: filteredCos.filter(c => c.freq === 'Квартальная').length,
    once: filteredCos.filter(c => c.freq === 'Разовая').length,
    closing: filteredCos.filter(c => c.freq === 'На закрытие').length,
  }
  const active = filteredTasks.filter(t => t.st === 'В работе')
  const stTasks = {
    total: filteredTasks.length,
    active: active.length,
    done: filteredTasks.filter(t => t.st === 'Выполнено').length,
    critical: active.filter(t => t.prio === 'Критично').length,
    urgent: active.filter(t => t.prio === 'Срочно').length,
    overdue: active.filter(t => dl(t.date) < 0).length,
  }
  const actCos = companies.filter(c => c.status === 'Активная' && ['Ежедневная', 'Раз в месяц', 'Квартальная'].includes(c.freq))
  const taxAct = taxFreq ? actCos.filter(c => c.freq === taxFreq) : actCos
  const stTax = {
    count: taxAct.length,
    mainPaid: taxAct.filter(c => taxDone[`${c.n}|main|${taxMonth}`]).length,
  }
  const reps = buildReports(companies)
  function applyRepFilters(list: RepEntry[]) {
    return list.filter(r => {
      if (repQ && r.q !== repQ) return false
      if (repReg && r.reg !== repReg) return false
      const key = `${r.co}|${r.type}|${r.q}`
      if (repStatus === 'done' && !repDone[key]) return false
      if (repStatus === 'pending' && repDone[key]) return false
      return true
    })
  }
  const taxReps = applyRepFilters(reps.tax)
  const statReps = applyRepFilters(reps.stat)
  const stRep = {
    taxTotal: taxReps.length,
    taxDone: taxReps.filter(r => repDone[`${r.co}|${r.type}|${r.q}`]).length,
    statTotal: statReps.length,
    statDone: statReps.filter(r => repDone[`${r.co}|${r.type}|${r.q}`]).length,
    overdue: taxReps.filter(r => !repDone[`${r.co}|${r.type}|${r.q}`] && dl(r.due) < 0).length,
  }

  if (status === 'loading') return <div className="loading">Загрузка...</div>
  if (!session) return null

  const today = new Date()
  const dateStr = today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  const activeCompanies = companies.filter(c => c.status === 'Активная')

  return (
    <div className="crm-layout">
      {/* ── SIDEBAR ── */}
      <aside className="crm-sidebar">
        <div className="crm-sidebar-logo">
          <div className="logo-icon">B</div>
          <h1>BuhDesk</h1>
        </div>

        <nav className="crm-sidebar-nav">
          {([['co', 'ti-building', 'Компании'], ['tasks', 'ti-checklist', 'Задачи'], ['tax', 'ti-cash', 'Налоги до 25-го'], ['rep', 'ti-file-check', 'Отчётность'], ['add', 'ti-plus', 'Добавить']] as [TabId, string, string][]).map(([id, icon, label]) => (
            <button key={id} className={`crm-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              <i className={`ti ${icon}`}></i>{label}
            </button>
          ))}
        </nav>

        <div className="crm-sidebar-bottom">
          <div className="crm-sidebar-user">
            <div className="user-avatar">{userName.charAt(0) || 'A'}</div>
            <span className="user-name">{userName || 'Администратор'}</span>
          </div>
          <button className="crm-logout" onClick={() => signOut({ callbackUrl: '/login' })}>
            <i className="ti ti-logout"></i>Выйти
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="crm-main">
        {/* Топбар */}
        <div className="crm-topbar">
          <span className="crm-topbar-title">
            {tab === 'co' ? 'Компании' : tab === 'tasks' ? 'Задачи' : tab === 'tax' ? 'Налоги до 25-го' : tab === 'rep' ? 'Отчётность' : 'Добавить компанию'}
          </span>
          <div className="crm-topbar-actions">
            <span className={`sync-status ${syncCls}`}>{syncText}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{dateStr}</span>
            <button className="crm-icon-btn" onClick={() => setShowNotif(true)} title="Уведомления">
              <i className="ti ti-bell"></i>
              {myTasks.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 9, padding: '1px 4px', fontWeight: 600, lineHeight: 1 }}>{myTasks.length}</span>}
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="crm-content">

      {/* ═══════════════ КОМПАНИИ ═══════════════ */}
      <div className={`crm-sec${tab === 'co' ? ' active' : ''}`}>
        <div className="srow">
          <div className="stat s-indigo"><div className="sl">Всего</div><div className="sv">{stCo.total}</div></div>
          <div className="stat s-sky"><div className="sl">Ежедневные</div><div className="sv">{stCo.daily}</div></div>
          <div className="stat s-sky"><div className="sl">Раз в месяц</div><div className="sv">{stCo.monthly}</div></div>
          <div className="stat s-purple"><div className="sl">Квартальные</div><div className="sv">{stCo.quarterly}</div></div>
          <div className="stat s-amber"><div className="sl">Разовые</div><div className="sv">{stCo.once}</div></div>
          <div className="stat s-red"><div className="sl">На закрытие</div><div className="sv red">{stCo.closing}</div></div>
        </div>
        <div className="ff">
          <input type="text" placeholder="Поиск компании..." value={coQ} onChange={e => setCoQ(e.target.value)} />
          <select value={coFreq} onChange={e => setCoFreq(e.target.value)}>
            <option value="">Все группы</option>
            <option>Ежедневная</option><option>Раз в месяц</option><option>Квартальная</option><option>Разовая</option><option>На закрытие</option>
          </select>
          <select value={coCat} onChange={e => setCoCat(e.target.value)}>
            <option value="">Все категории</option>
            <option>КАФЕШКИ</option><option>ПЕРЕПРОДАЖА</option><option>ПРОИЗВОДСТВО</option><option>СТРОИТЕЛЬСТВО</option><option>ПРОЧИЕ УСЛУГИ</option><option>ИП-ЖОО</option><option>Школы JOO</option><option>РАЗОВОЕ</option>
          </select>
          <select value={coReg} onChange={e => setCoReg(e.target.value)}>
            <option value="">Все режимы</option>
            <option value="НДС">НДС</option><option value="УПРОЩЕНКА">Упрощёнка</option><option value="ОУР">ОУР</option>
          </select>
        </div>
        <div className="tw">
          <table>
            <colgroup><col style={{ width: '30%' }} /><col style={{ width: '14%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} /><col style={{ width: '12%' }} /><col style={{ width: '14%' }} /></colgroup>
            <thead><tr><th>Организация</th><th>Группа</th><th>Режим</th><th>Категория</th><th>1С база</th><th>Риск</th><th style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {filteredCos.map(c => (
                <tr key={c.id || c.n} style={{ cursor: 'pointer' }} onClick={() => { setEditCoData({ ...c }); setEditCoIdx(companies.findIndex(x => x.n === c.n)) }}>
                  <td style={{ fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.n}>{c.n}</td>
                  <td><span className={`b ${FC[c.freq] || 'bk'}`}>{c.freq}</span></td>
                  <td>{regBadge(c.reg)}</td>
                  <td style={{ fontSize: 10.5, color: '#5f5e5a' }}>{c.cat}</td>
                  <td>{c.b === 'БАР' ? <span className="b bg">есть</span> : <span className="b bk">нет</span>}</td>
                  <td>{c.risk === 'высокая' ? <span className="b br">выс.</span> : c.risk === 'средняя' ? <span className="b ba">средн.</span> : <span className="b bg">низк.</span>}</td>
                  <td><button className="btn-del" onClick={e => { e.stopPropagation(); deleteCo(c) }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cnt">Показано: {filteredCos.length} из {companies.length}</div>
      </div>

      {/* ═══════════════ ЗАДАЧИ ═══════════════ */}
      <div className={`crm-sec${tab === 'tasks' ? ' active' : ''}`}>
        <div className="srow">
          <div className="stat s-indigo"><div className="sl">Всего</div><div className="sv">{stTasks.total}</div></div>
          <div className="stat s-sky"><div className="sl">В работе</div><div className="sv amber">{stTasks.active}</div></div>
          <div className="stat s-green"><div className="sl">Выполнено</div><div className="sv green">{stTasks.done}</div></div>
          <div className="stat s-red"><div className="sl">Критично</div><div className="sv red">{stTasks.critical}</div></div>
          <div className="stat s-amber"><div className="sl">Срочно</div><div className="sv amber">{stTasks.urgent}</div></div>
          <div className="stat s-red"><div className="sl">Просрочено</div><div className="sv red">{stTasks.overdue}</div></div>
        </div>
        <div className="ff">
          <input type="text" placeholder="Поиск..." value={taskQ} onChange={e => setTaskQ(e.target.value)} />
          <select value={taskEmp} onChange={e => setTaskEmp(e.target.value)}>
            <option value="">Все сотрудники</option>
            {users.map(u => <option key={u}>{u}</option>)}
          </select>
          <select value={taskPrio} onChange={e => setTaskPrio(e.target.value)}>
            <option value="">Все приоритеты</option>
            <option>Критично</option><option>Срочно</option><option>Обычный</option>
          </select>
          <select value={taskStat} onChange={e => setTaskStat(e.target.value)}>
            <option value="">Все статусы</option>
            <option>В работе</option><option>Выполнено</option>
          </select>
        </div>
        <div>
          {filteredTasks.length === 0 ? <div className="empty">Нет задач</div> : filteredTasks.map(t => {
            const d = t.date ? dl(t.date) : 0
            const dc = d < 0 ? 'dov' : d <= 3 ? 'dwa' : 'dok'
            const dt = d < 0 ? `просрочено ${Math.abs(d)}д` : d === 0 ? 'сегодня!' : `${d} дн.`
            return (
              <div key={t.id || t.co + t.desc} className="tcard">
                <div className="tc-h"><div className="tc-co">{t.co}</div>{pBadge(t.prio)}</div>
                <div className="tc-d">{t.desc}</div>
                <div className="tc-f">
                  <span className="b bb">{t.emp}</span>
                  <span className={dc}>{t.date} · {dt}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                    {t.st === 'В работе' ? (
                      <button className="btn-sm" onClick={() => doneTask(t)}>Готово ✓</button>
                    ) : (
                      <span className="b bg">Выполнено</span>
                    )}
                    <button className="btn-sm" style={{ background: '#f5f5f0', color: '#5f5e5a', border: '1px solid #d3d1c7' }}
                      onClick={() => { setEditTaskData({ ...t }); setEditTaskIdx(tasks.findIndex(x => x.id === t.id)) }}>✏️</button>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <hr className="divider" />
        <div className="ftitle">+ Новая задача</div>
        <div className="fr" style={{ marginBottom: 9 }}>
          <div className="fg"><label>Компания</label>
            <select value={newTaskCo} onChange={e => setNewTaskCo(e.target.value)}>
              <option value="">— выберите —</option>
              {activeCompanies.map(c => <option key={c.n}>{c.n}</option>)}
            </select>
          </div>
          <div className="fg"><label>Ответственный</label>
            <select value={newTaskEmp} onChange={e => setNewTaskEmp(e.target.value)}>
              {users.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div className="fg"><label>Описание задачи</label>
          <textarea rows={2} placeholder="Что нужно сделать..." value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
        </div>
        <div className="fr" style={{ marginBottom: 9 }}>
          <div className="fg"><label>Срок</label><input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)} /></div>
          <div className="fg"><label>Приоритет</label>
            <select value={newTaskPrio} onChange={e => setNewTaskPrio(e.target.value)}>
              <option>Обычный</option><option>Срочно</option><option>Критично</option>
            </select>
          </div>
        </div>
        <button className="btn" onClick={addTask}>Добавить задачу</button>
      </div>

      {/* ═══════════════ НАЛОГИ ═══════════════ */}
      <div className={`crm-sec${tab === 'tax' ? ' active' : ''}`}>
        <div className="srow">
          <div className="stat s-indigo"><div className="sl">Компаний</div><div className="sv">{stTax.count}</div></div>
          <div className="stat s-green"><div className="sl">Нал. уплачено</div><div className="sv green">{stTax.mainPaid}</div></div>
          <div className="stat s-red"><div className="sl">Нал. не уплачено</div><div className="sv red">{stTax.count - stTax.mainPaid}</div></div>
        </div>
        <div className="stabs">
          <button className={`stab${taxSubTab === 'main' ? ' active' : ''}`} onClick={() => setTaxSubTab('main')}>Налоговые платежи</button>
        </div>
        <div className="ff" style={{ marginBottom: 9 }}>
          <select value={taxMonth} onChange={e => setTaxMonth(+e.target.value)}>
            {[6, 7, 8, 9, 10, 11, 12].map(m => <option key={m} value={m}>{MN[m]} 2026</option>)}
          </select>
          <select value={taxFreq} onChange={e => setTaxFreq(e.target.value)}>
            <option value="">Все группы</option>
            <option value="Ежедневная">Ежедневные</option><option value="Раз в месяц">Раз в месяц</option><option value="Квартальная">Квартальные</option>
          </select>
        </div>
        <TaxSection companies={companies} taxDone={taxDone} taxMonth={taxMonth} taxFreq={taxFreq} onToggle={toggleTax} />
      </div>

      {/* ═══════════════ ОТЧЁТНОСТЬ ═══════════════ */}
      <div className={`crm-sec${tab === 'rep' ? ' active' : ''}`}>
        <div className="srow">
          <div className="stat s-indigo"><div className="sl">Нал. всего</div><div className="sv">{stRep.taxTotal}</div></div>
          <div className="stat s-green"><div className="sl">Нал. сдано</div><div className="sv green">{stRep.taxDone}</div></div>
          <div className="stat s-red"><div className="sl">Нал. не сдано</div><div className="sv red">{stRep.taxTotal - stRep.taxDone}</div></div>
          <div className="stat s-purple"><div className="sl">Стат. всего</div><div className="sv">{stRep.statTotal}</div></div>
          <div className="stat s-green"><div className="sl">Стат. сдано</div><div className="sv green">{stRep.statDone}</div></div>
          <div className="stat s-red"><div className="sl">Просрочено</div><div className="sv red">{stRep.overdue}</div></div>
        </div>
        <div className="stabs">
          <button className={`stab${repSubTab === 'tax' ? ' active' : ''}`} onClick={() => setRepSubTab('tax')}>Налоговые отчёты</button>
          <button className={`stab${repSubTab === 'stat' ? ' active' : ''}`} onClick={() => setRepSubTab('stat')}>Статистические отчёты</button>
        </div>
        <div className="ff" style={{ marginBottom: 9 }}>
          <select value={repQ} onChange={e => setRepQ(e.target.value)}>
            <option value="">Все кварталы</option>
            <option>1 квартал</option><option>2 квартал</option><option>3 квартал</option><option>4 квартал</option><option>Годовой</option>
          </select>
          <select value={repReg} onChange={e => setRepReg(e.target.value)}>
            <option value="">Все режимы</option>
            <option value="ОУР (НДС)">ОУР с НДС</option><option value="ОУР">ОУР без НДС</option><option value="УПРОЩЕНКА">Упрощёнка</option><option value="КХ">КХ</option>
          </select>
          <select value={repStatus} onChange={e => setRepStatus(e.target.value)}>
            <option value="">Все статусы</option>
            <option value="pending">Не сдан</option><option value="done">Сдан</option>
          </select>
        </div>
        <ReportsSection
          reports={repSubTab === 'tax' ? reps.tax : reps.stat}
          repDone={repDone}
          taxDone={taxDone}
          repQ={repQ} repReg={repReg} repStatus={repStatus}
          onToggleRep={toggleRep}
          onToggleMonthTax={toggleMonthTax}
        />
      </div>

      {/* ═══════════════ ДОБАВИТЬ ═══════════════ */}
      <div className={`crm-sec${tab === 'add' ? ' active' : ''}`}>
        <div className="ftitle">Добавить новую компанию</div>
        <div className="fr">
          <div className="fg"><label>Наименование *</label><input type="text" placeholder="ТОО / ИП ..." value={newCoName} onChange={e => setNewCoName(e.target.value)} /></div>
          <div className="fg"><label>БИН / ИИН</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" placeholder="12 цифр" maxLength={12} value={newCoBin} onChange={e => setNewCoBin(e.target.value.replace(/\D/g, ''))} style={{ flex: 1 }} />
              <button type="button" className="btn" style={{ padding: '4px 12px', fontSize: 11, whiteSpace: 'nowrap' }} onClick={lookupBin} disabled={newCoBinLoading}>
                {newCoBinLoading ? '...' : 'Найти'}
              </button>
            </div>
          </div>
        </div>
        <div className="fr3">
          <div className="fg"><label>Режим *</label>
            <input list="reg-list" placeholder="ОУР, УПРОЩЕНКА..." value={newCoReg} onChange={e => setNewCoReg(e.target.value)} />
            <datalist id="reg-list"><option value="ОУР (НДС)" /><option value="ОУР" /><option value="УПРОЩЕНКА" /><option value="СНР" /><option value="КХ" /></datalist>
          </div>
          <div className="fg"><label>НДС плательщик</label>
            <select value={newCoNds} onChange={e => setNewCoNds(e.target.value)}>
              <option value="нет">Нет</option><option value="да">Да</option>
            </select>
          </div>
          <div className="fg"><label>Группа обслуживания *</label>
            <input list="freq-list" placeholder="Ежедневная..." value={newCoFreq} onChange={e => setNewCoFreq(e.target.value)} />
            <datalist id="freq-list"><option value="Ежедневная" /><option value="Раз в месяц" /><option value="Квартальная" /><option value="Разовая" /><option value="На закрытие" /></datalist>
          </div>
        </div>
        <div className="fr">
          <div className="fg"><label>Категория *</label>
            <input list="cat-list" placeholder="КАФЕШКИ, ИП-ЖОО..." value={newCoCat} onChange={e => setNewCoCat(e.target.value)} />
            <datalist id="cat-list"><option value="КАФЕШКИ" /><option value="ПЕРЕПРОДАЖА" /><option value="ПРОИЗВОДСТВО" /><option value="СТРОИТЕЛЬСТВО" /><option value="ПРОЧИЕ УСЛУГИ" /><option value="ИП-ЖОО" /><option value="Школы JOO" /><option value="РАЗОВОЕ" /></datalist>
          </div>
          <div className="fg"><label>Чем занимается</label><input type="text" placeholder="кафе, доставка..." /></div>
        </div>
        <div className="fr">
          <div className="fg"><label>1С база</label>
            <select value={newCoBase} onChange={e => setNewCoBase(e.target.value)}>
              <option value="БАР">ЕСТЬ</option><option value="ЖОҚ">НЕТ</option>
            </select>
          </div>
          <div className="fg"><label>Степень риска</label>
            <select value={newCoRisk} onChange={e => setNewCoRisk(e.target.value)}>
              <option>низкая</option><option>средняя</option><option>высокая</option>
            </select>
          </div>
        </div>
        <div className="fr">
          <div className="fg"><label>Статус</label>
            <select value={newCoStatus} onChange={e => setNewCoStatus(e.target.value)}>
              <option value="Активная">Активная</option><option value="Приостановлена">Приостановлена</option><option value="На закрытие">На закрытие</option>
            </select>
          </div>
        </div>
        <div className="ibox">
          {newCoReg ? {
            'ОУР (НДС)': '300.00 (каждый квартал) · 200.00 (каждый квартал) · 100.00 (годовая)',
            'ОУР': '200.00 (каждый квартал) · 100.00 (годовая)',
            'УПРОЩЕНКА': '910.00 (во 2 и 4 квартале) · 200.00 (каждый квартал)',
            'СНР': '910.00 (во 2 и 4 квартале) · 200.00 (каждый квартал)',
            'КХ': '920.00 (годовая)',
          }[newCoReg] || 'Выберите режим — отчёты создадутся автоматически' : 'Выберите режим — отчёты создадутся автоматически'}
        </div>
        <button className="btn" onClick={addCo}>Добавить компанию</button>
        {addMsg && <div style={{ fontSize: 11, color: '#3b6d11', marginTop: 8, fontWeight: 500 }}>{addMsg}</div>}
      </div>

      {/* ═══════════════ МОДАЛ УВЕДОМЛЕНИЙ ═══════════════ */}
      {showNotif && (
        <div className="modal-bg open" onClick={() => setShowNotif(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>🔔 Задачи для {userName}</h3>
              <button className="modal-close" onClick={() => setShowNotif(false)}>×</button>
            </div>
            {myTasks.length === 0 && myDone.length === 0 ? <div className="empty">Нет задач</div> : (
              <div>
                {myTasks.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#854f0b', marginBottom: 8 }}>В работе ({myTasks.length})</div>
                    {myTasks.map(t => {
                      const d = dl(t.date), dc = d < 0 ? '#a32d2d' : d <= 3 ? '#854f0b' : '#3b6d11'
                      const dt = d < 0 ? `просрочено ${Math.abs(d)}д` : d === 0 ? 'сегодня!' : `${d} дн.`
                      return (
                        <div key={t.id} style={{ border: '1px solid #e0dfd6', borderRadius: 8, padding: '8px 10px', marginBottom: 6, background: '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{t.co}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: t.prio === 'Критично' ? '#a32d2d' : t.prio === 'Срочно' ? '#854f0b' : '#444' }}>{t.prio}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#5f5e5a', marginBottom: 4 }}>{t.desc}</div>
                          <div style={{ fontSize: 10, color: dc }}>{t.date} · {dt}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {myDone.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#3b6d11', margin: '10px 0 8px' }}>Выполнено ({myDone.length})</div>
                    {myDone.map(t => (
                      <div key={t.id} style={{ border: '1px solid #e0dfd6', borderRadius: 8, padding: '6px 10px', marginBottom: 5, background: '#f9f8f5', opacity: .7 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, textDecoration: 'line-through' }}>{t.co}</div>
                        <div style={{ fontSize: 10, color: '#888780' }}>{t.desc}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ МОДАЛ РЕДАКТИРОВАНИЯ КОМПАНИИ ═══════════════ */}
      {editCoData && (
        <div className="modal-bg open" onClick={() => { setEditCoIdx(-1); setEditCoData(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Редактировать компанию</h3>
              <button className="modal-close" onClick={() => { setEditCoIdx(-1); setEditCoData(null) }}>×</button>
            </div>
            <div className="fg"><label>Наименование</label>
              <input type="text" value={editCoData.n} onChange={e => setEditCoData(p => p ? { ...p, n: e.target.value } : p)} />
            </div>
            <div className="fr">
              <div className="fg"><label>Режим</label>
                <input list="e-reg-list" value={editCoData.reg} onChange={e => setEditCoData(p => p ? { ...p, reg: e.target.value } : p)} />
                <datalist id="e-reg-list"><option value="ОУР (НДС)" /><option value="ОУР" /><option value="УПРОЩЕНКА" /><option value="СНР" /><option value="КХ" /></datalist>
              </div>
              <div className="fg"><label>Группа</label>
                <input list="e-freq-list" value={editCoData.freq} onChange={e => setEditCoData(p => p ? { ...p, freq: e.target.value } : p)} />
                <datalist id="e-freq-list"><option value="Ежедневная" /><option value="Раз в месяц" /><option value="Квартальная" /><option value="Разовая" /><option value="На закрытие" /></datalist>
              </div>
            </div>
            <div className="fr">
              <div className="fg"><label>Категория</label>
                <input list="e-cat-list" value={editCoData.cat} onChange={e => setEditCoData(p => p ? { ...p, cat: e.target.value } : p)} />
                <datalist id="e-cat-list"><option value="КАФЕШКИ" /><option value="ПЕРЕПРОДАЖА" /><option value="ПРОИЗВОДСТВО" /><option value="СТРОИТЕЛЬСТВО" /><option value="ПРОЧИЕ УСЛУГИ" /><option value="ИП-ЖОО" /><option value="Школы JOO" /><option value="РАЗОВОЕ" /></datalist>
              </div>
              <div className="fg"><label>1С база</label>
                <select value={editCoData.b} onChange={e => setEditCoData(p => p ? { ...p, b: e.target.value } : p)}>
                  <option value="БАР">ЕСТЬ</option><option value="ЖОҚ">НЕТ</option>
                </select>
              </div>
            </div>
            <div className="fr">
              <div className="fg"><label>Риск</label>
                <select value={editCoData.risk} onChange={e => setEditCoData(p => p ? { ...p, risk: e.target.value } : p)}>
                  <option value="низкая">Низкая</option><option value="средняя">Средняя</option><option value="высокая">Высокая</option>
                </select>
              </div>
              <div className="fg"><label>Статус</label>
                <select value={editCoData.status} onChange={e => setEditCoData(p => p ? { ...p, status: e.target.value } : p)}>
                  <option value="Активная">Активная</option><option value="Приостановлена">Приостановлена</option><option value="На закрытие">На закрытие</option>
                </select>
              </div>
            </div>
            <EditCoReports company={editCoData} onChange={setEditCoData} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn" onClick={saveCoEdit}>Сохранить</button>
              <button className="btn-warn" onClick={deleteCoFromModal}>Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ МОДАЛ РЕДАКТИРОВАНИЯ ЗАДАЧИ ═══════════════ */}
      {editTaskData && (
        <div className="modal-bg open" onClick={() => { setEditTaskIdx(-1); setEditTaskData(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Редактировать задачу</h3>
              <button className="modal-close" onClick={() => { setEditTaskIdx(-1); setEditTaskData(null) }}>×</button>
            </div>
            <div className="fg"><label>Компания</label>
              <select value={editTaskData.co} onChange={e => setEditTaskData(p => p ? { ...p, co: e.target.value } : p)}>
                {companies.map(c => <option key={c.n}>{c.n}</option>)}
              </select>
            </div>
            <div className="fg"><label>Описание</label>
              <textarea rows={2} value={editTaskData.desc} onChange={e => setEditTaskData(p => p ? { ...p, desc: e.target.value } : p)} />
            </div>
            <div className="fr">
              <div className="fg"><label>Ответственный</label>
                <select value={editTaskData.emp} onChange={e => setEditTaskData(p => p ? { ...p, emp: e.target.value } : p)}>
                  {users.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="fg"><label>Приоритет</label>
                <select value={editTaskData.prio} onChange={e => setEditTaskData(p => p ? { ...p, prio: e.target.value } : p)}>
                  <option>Обычный</option><option>Срочно</option><option>Критично</option>
                </select>
              </div>
            </div>
            <div className="fr">
              <div className="fg"><label>Срок</label>
                <input type="date" value={editTaskData.date} onChange={e => setEditTaskData(p => p ? { ...p, date: e.target.value } : p)} />
              </div>
              <div className="fg"><label>Статус</label>
                <select value={editTaskData.st} onChange={e => setEditTaskData(p => p ? { ...p, st: e.target.value } : p)}>
                  <option>В работе</option><option>Выполнено</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn" onClick={saveTaskEdit}>Сохранить</button>
              <button className="btn-warn" onClick={deleteTask}>Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* ТОСТ */}
      <div className={`toast${toastVisible ? ' show' : ''}`}>{toast}</div>
        </div>{/* /crm-content */}
      </div>{/* /crm-main */}
    </div>
  )
}

// ─── КОМПОНЕНТ: НАЛОГИ ──────────────────
function TaxSection({ companies, taxDone, taxMonth, taxFreq, onToggle }: {
  companies: Company[]; taxDone: Record<string, boolean>; taxMonth: number; taxFreq: string; onToggle: (key: string) => void
}) {
  const MN = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  const FC: Record<string, string> = { 'Ежедневная': 'bb', 'Раз в месяц': 'bt', 'Квартальная': 'bp' }
  const grps = [
    { label: 'Ежедневные', freq: 'Ежедневная' },
    { label: 'Раз в месяц', freq: 'Раз в месяц' },
    { label: 'Квартальные', freq: 'Квартальная' },
  ]
  return (
    <div>
      {grps.map(g => {
        if (taxFreq && taxFreq !== g.freq) return null
        const rows = companies.filter(c => c.freq === g.freq && c.status === 'Активная' && getTaxTypes(c.reg).length > 0)
        if (!rows.length) return null
        const dn = rows.filter(c => taxDone[`${c.n}|main|${taxMonth}`]).length
        return (
          <div key={g.freq} className="tgrp">
            <div className="tgrp-t">
              <span className={`b ${FC[g.freq]}`}>{g.label}</span>
              <span style={{ color: '#3b6d11' }}>{dn}</span>/{rows.length} · до 25 {MN[taxMonth]}
            </div>
            {rows.map(c => {
              const key = `${c.n}|main|${taxMonth}`
              const done = taxDone[key]
              return (
                <div key={c.n} className="trow">
                  <input type="checkbox" className="chk" checked={!!done} onChange={() => onToggle(key)} />
                  {regBadge(c.reg)}
                  <div className={`tname${done ? ' sk' : ''}`} style={{ marginLeft: 5 }}>{c.n}</div>
                  <div className="ttypes">{getTaxTypes(c.reg).join(' · ')}</div>
                  <span className={`b ${done ? 'bg' : 'ba'}`}>{done ? 'уплачен' : 'до 25-го'}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── КОМПОНЕНТ: ОТЧЁТНОСТЬ ──────────────
function ReportsSection({ reports, repDone, taxDone, repQ, repReg, repStatus, onToggleRep, onToggleMonthTax }: {
  reports: RepEntry[]; repDone: Record<string, boolean>; taxDone: Record<string, boolean>
  repQ: string; repReg: string; repStatus: string
  onToggleRep: (key: string) => void; onToggleMonthTax: (key: string) => void
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  function dlLocal(d: string) {
    const x = new Date(d); x.setHours(0, 0, 0, 0)
    return Math.round((x.getTime() - today.getTime()) / 86400000)
  }

  const list = reports.filter(r => {
    if (repReg && r.reg !== repReg) return false
    if (repQ && r.q !== repQ) return false
    const key = `${r.co}|${r.type}|${r.q}`
    if (repStatus === 'done' && !repDone[key]) return false
    if (repStatus === 'pending' && repDone[key]) return false
    return true
  })
  const byQ: Record<string, RepEntry[]> = {}
  for (const r of list) { if (!byQ[r.q]) byQ[r.q] = []; byQ[r.q].push(r) }

  return (
    <div>
      {QORDER.map(qKey => {
        const items = byQ[qKey]
        if (!items?.length) return null
        const months = QM[qKey] || []
        const tot = items.length
        const dn = items.filter(r => repDone[`${r.co}|${r.type}|${r.q}`]).length
        const has910 = items.some(r => r.type.includes('910'))
        return (
          <div key={qKey} className="q-block">
            <div className="q-head">
              <span>{QLABELS[qKey] || qKey}</span>
              {has910 && <span className="b bt">910</span>}
              <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 400 }}>
                <span style={{ color: '#3b6d11' }}>{dn}</span> / {tot} сдано
              </span>
            </div>
            <div className="q-table">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '26%' }}>Организация</th>
                    <th style={{ width: '14%' }}>Режим</th>
                    <th style={{ width: '14%' }}>Отчёт</th>
                    <th style={{ width: '8%' }} className="center">Срок</th>
                    <th style={{ width: '10%' }} className="center">Статус</th>
                    {months.map(m => <th key={m} style={{ width: '9%' }} className="center">{MN_S[m]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => {
                    const rKey = `${r.co}|${r.type}|${r.q}`
                    const done = repDone[rKey]
                    const d = dlLocal(r.due)
                    const dt = done ? '✓ сдан' : d < 0 ? `просроч.${Math.abs(d)}д` : `${d} дн.`
                    const tc = r.type.includes('910') ? 'bt' : r.type.includes('300') ? 'br' : r.type.includes('200') ? 'bp' : 'ba'
                    const sk = done ? { textDecoration: 'line-through' as const, color: '#b4b2a9' } : {}
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', ...sk }} title={r.co}>{r.co}</td>
                        <td>{regBadge(r.reg)}</td>
                        <td>
                          <span className={`b ${tc}`} style={{ fontSize: 9 }}>{r.type.split(' ')[0]}</span>{' '}
                          <span style={{ fontSize: 10, color: '#888780' }}>{r.type.split(' ').slice(1).join(' ')}</span>
                        </td>
                        <td className="center"><span style={{ fontSize: 10, color: '#888780' }}>{r.due.slice(5)}</span></td>
                        <td className="center">
                          <div className={`tax-cell ${done ? 'tax-paid' : 'tax-unpaid'}`} onClick={() => onToggleRep(rKey)} style={{ cursor: 'pointer' }}>
                            {done ? '✓ сдан' : '✗ не сдан'}
                          </div>
                        </td>
                        {months.map(m => {
                          if (!r.months) return <td key={m} className="center"><span style={{ color: '#b4b2a9', fontSize: 10 }}>—</span></td>
                          const mKey = `${r.co}|main|${m}`
                          const paid = taxDone[mKey]
                          return (
                            <td key={m} className="center">
                              <div className={`tax-cell ${paid ? 'tax-paid' : 'tax-unpaid'}`} style={{ minWidth: 0, fontSize: 9.5 }} onClick={() => onToggleMonthTax(mKey)}>
                                {paid ? '✓' : '✗'}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
      {Object.keys(byQ).length === 0 && <div className="empty">Нет отчётов по фильтру</div>}
    </div>
  )
}

// ─── КОМПОНЕНТ: РЕДАКТИРОВАНИЕ ОТЧЁТОВ КОМПАНИИ ──────────────
function EditCoReports({ company, onChange }: { company: Company; onChange: (fn: (p: Company | null) => Company | null) => void }) {
  const [newRepName, setNewRepName] = useState('')
  const [newRepPeriod, setNewRepPeriod] = useState('quarterly')
  const [newRepType, setNewRepType] = useState('tax')

  const taxReports: Record<string, string[]> = {
    'ОУР (НДС)': ['300.00 (НДС)', '200.00 (ИПН/СН)', '100.00 (КПН годовой)'],
    'ОУР': ['200.00 (ИПН/СН)', '100.00 (КПН годовой)'],
    'УПРОЩЕНКА': ['910.00 (упрощённая)', '200.00 (ИПН сотр.)'],
    'СНР': ['910.00 (упрощённая)', '200.00 (ИПН сотр.)'],
    'КХ': ['920.00 (декл. КХ)'],
  }
  const statReports: Record<string, string[]> = {
    'ОУР (НДС)': ['1-Услуги (стат.)', '11-МП (год. стат.)'],
    'ОУР': ['1-Услуги (стат.)', '11-МП (год. стат.)'],
    'УПРОЩЕНКА': ['2МП (стат.)', '11-МП (год. стат.)'],
    'СНР': ['2МП (стат.)', '11-МП (год. стат.)'],
    'КХ': [],
  }

  const skip = company.skipReports || []
  const extra = company.extraReports || []
  const taxList = taxReports[company.reg] || []
  const statList = statReports[company.reg] || []

  function toggleSkip(rep: string, shouldSkip: boolean) {
    onChange(p => {
      if (!p) return p
      const sk = [...(p.skipReports || [])]
      if (shouldSkip) { if (!sk.includes(rep)) sk.push(rep) }
      else { const i = sk.indexOf(rep); if (i >= 0) sk.splice(i, 1) }
      return { ...p, skipReports: sk }
    })
  }

  function removeExtra(rep: string) {
    onChange(p => p ? { ...p, extraReports: (p.extraReports || []).filter(e => e !== rep) } : p)
  }

  function addExtra() {
    const name = newRepName.trim()
    if (!name) return
    const key = `${name}|${newRepPeriod}|${newRepType}`
    onChange(p => p ? { ...p, extraReports: [...(p.extraReports || []), key] } : p)
    setNewRepName('')
  }

  const extraOwn = extra.filter(e => {
    const name = e.split('|')[0]
    return ![...taxList, ...statList].includes(name) && ![...taxList, ...statList].includes(e)
  })

  return (
    <div className="fg" style={{ marginTop: 4 }}>
      <label>Отчёты (снять галочку = не сдают)</label>
      <div style={{ padding: 8, background: '#f5f5f0', borderRadius: 6, border: '1px solid #e0dfd6', marginTop: 6 }}>
        {taxList.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#185fa5', fontWeight: 600, marginBottom: 5 }}>📋 Налоговые отчёты</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 12 }}>
              {taxList.map(r => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 6px', borderRadius: 5, border: '1px solid #e0dfd6', background: '#fff' }}>
                  <input type="checkbox" checked={!skip.includes(r)} onChange={e => toggleSkip(r, !e.target.checked)} style={{ accentColor: '#185fa5' }} />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {statList.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#27500A', fontWeight: 600, marginBottom: 5 }}>📊 Статистические отчёты</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 12 }}>
              {statList.map(r => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 6px', borderRadius: 5, border: '1px solid #e0dfd6', background: '#fff' }}>
                  <input type="checkbox" checked={!skip.includes(r)} onChange={e => toggleSkip(r, !e.target.checked)} style={{ accentColor: '#185fa5' }} />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {extraOwn.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#633806', fontWeight: 600, marginBottom: 5 }}>➕ Дополнительные</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 }}>
              {extraOwn.map(e => {
                const parts = e.split('|'); const name = parts[0]; const period = parts[1]; const rtype = parts[2]
                const periodLabel = period === 'quarterly' ? 'кварт.' : period === 'monthly' ? 'ежемес.' : 'годовой'
                const typeLabel = rtype === 'stat' ? '📊' : '📋'
                return (
                  <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 6px', borderRadius: 5, border: '1px solid #fbbf24', background: '#fffbeb' }}>
                    <input type="checkbox" checked={!skip.includes(e)} onChange={ev => toggleSkip(e, !ev.target.checked)} style={{ accentColor: '#185fa5' }} />
                    <span>{typeLabel} {name} <span style={{ color: '#888780', fontSize: 9 }}>({periodLabel})</span></span>
                    <button onClick={() => removeExtra(e)} style={{ background: 'none', border: 'none', color: '#791F1F', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <div style={{ borderTop: '1px solid #e0dfd6', paddingTop: 8, marginTop: 4 }}>
          <div style={{ fontSize: 10, color: '#444', fontWeight: 600, marginBottom: 6 }}>+ Добавить отчёт</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
            <input
              type="text"
              placeholder="Название отчёта..."
              value={newRepName}
              onChange={e => setNewRepName(e.target.value)}
              style={{ flex: 1, minWidth: 120, fontSize: 11, padding: '3px 7px', border: '1px solid #d3d1c7', borderRadius: 5 }}
              onKeyDown={e => e.key === 'Enter' && addExtra()}
            />
            <select value={newRepPeriod} onChange={e => setNewRepPeriod(e.target.value)} style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #d3d1c7', borderRadius: 5 }}>
              <option value="quarterly">Каждый квартал</option>
              <option value="monthly">Ежемесячно</option>
              <option value="annual">Годовой</option>
            </select>
            <select value={newRepType} onChange={e => setNewRepType(e.target.value)} style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #d3d1c7', borderRadius: 5 }}>
              <option value="tax">📋 Налоговый</option>
              <option value="stat">📊 Статистический</option>
            </select>
            <button onClick={addExtra} style={{ fontSize: 11, padding: '3px 10px', background: '#185fa5', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>Добавить</button>
          </div>
        </div>
      </div>
    </div>
  )
}
