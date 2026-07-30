'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'

// ─── ТИПЫ ───────────────────────────────
type Company = { id?: string; n: string; freq: string; reg: string; cat: string; b: string; risk: string; nds: boolean; status: string; skipReports: string[]; extraReports: string[]; bin?: string; noReports?: boolean; hasEmployees?: boolean }
type Task = { id?: string; co: string; desc: string; emp: string; prio: string; date: string; st: string }
type TabId = 'co' | 'tasks' | 'tax' | 'rep' | 'pay' | 'admin'
type PayEntry = { amount: string; comment: string; paid: boolean }
type AdminReportItem = { code: string; period: 'quarterly' | 'annual' | 'monthly' | 'semi-annual'; hasMonths: boolean; onlyEvenQ?: boolean }
type AdminSettings = {
  regimes: string[]; categories: string[]; groups: string[]; bases: string[]; statuses: string[]; risks: string[]
  taxReports: Record<string, AdminReportItem[]>; statReports: Record<string, AdminReportItem[]>
}
type SyncCls = '' | 'syncing' | 'error'

// ─── КОНСТАНТЫ ──────────────────────────
const FC: Record<string, string> = { 'Ежедневная': 'bb', 'Раз в месяц': 'bt', 'Квартальная': 'bp', 'Разовая': 'bk', 'На закрытие': 'br' }
const MN = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const MN_S = ['', 'Янв', 'Фев', 'Март', 'Апр', 'Май', 'Июнь', 'Июль', 'Авг', 'Сент', 'Окт', 'Ноя', 'Дек']
const QM: Record<string, number[]> = { '1 квартал': [1, 2, 3], '2 квартал': [4, 5, 6], '3 квартал': [7, 8, 9], '4 квартал': [10, 11, 12] }
function getQTRS(y: number) {
  return [
    { q: '1 квартал', due300: `${y}-05-15`, due200: `${y}-05-15`, due910: '', has910: false },
    { q: '2 квартал', due300: `${y}-08-15`, due200: `${y}-08-15`, due910: `${y}-08-15`, has910: true },
    { q: '3 квартал', due300: `${y}-11-15`, due200: `${y}-11-15`, due910: '', has910: false },
    { q: '4 квартал', due300: `${y+1}-02-15`, due200: `${y+1}-02-15`, due910: `${y+1}-02-15`, has910: true },
  ]
}
function getQLABELS(y: number): Record<string, string> {
  return {
    '1 квартал': `1 квартал (янв–март ${y}) · до 15 мая ${y}`,
    '2 квартал': `2 квартал (апр–июнь ${y}) · до 15 авг ${y}`,
    '3 квартал': `3 квартал (июль–сент ${y}) · до 15 ноя ${y}`,
    '4 квартал': `4 квартал (окт–дек ${y}) · до 15 фев ${y+1}`,
    'Годовой': `Годовой (100/920) · до 31 марта ${y+1}`,
  }
}
const QORDER = ['1 квартал', '2 квартал', '3 квартал', '4 квартал', 'Годовой']
const DEFAULT_USERS = ['Нурдаулет', 'Акмарал', 'Динара', 'Жания', 'Ұлбосын', 'Айзат']
const DEFAULT_ADMIN: AdminSettings = {
  regimes: ['ОУР', 'УПРОЩЕНКА', 'СНР', 'КХ'],
  categories: ['КАФЕШКИ', 'ПЕРЕПРОДАЖА', 'ПРОИЗВОДСТВО', 'СТРОИТЕЛЬСТВО', 'ПРОЧИЕ УСЛУГИ', 'ИП-ЖОО', 'Школы JOO', 'РАЗОВОЕ', 'ПРОЧЕЕ'],
  groups: ['Ежедневная', 'Раз в месяц', 'Квартальная', 'Разовая', 'На закрытие'],
  bases: ['БАР', 'ЖОҚ'],
  statuses: ['Активная', 'Приостановлена', 'На закрытие', 'Закрыто'],
  risks: ['низкая', 'средняя', 'высокая'],
  taxReports: {
    'ОУР (НДС)': [
      { code: '300.00 (НДС)', period: 'quarterly', hasMonths: false },
      { code: '200.00 (ИПН/СН)', period: 'quarterly', hasMonths: true },
      { code: '100.00 (год. КПН)', period: 'annual', hasMonths: false },
    ],
    'ОУР': [
      { code: '200.00 (ИПН/СН)', period: 'quarterly', hasMonths: true },
      { code: '100.00 (год. КПН)', period: 'annual', hasMonths: false },
    ],
    'УПРОЩЕНКА': [
      { code: '200.00 (ИПН сотр.)', period: 'quarterly', hasMonths: true },
      { code: '910.00 (упрощённая)', period: 'quarterly', hasMonths: false, onlyEvenQ: true },
    ],
    'СНР': [
      { code: '200.00 (ИПН сотр.)', period: 'quarterly', hasMonths: true },
      { code: '910.00 (упрощённая)', period: 'quarterly', hasMonths: false, onlyEvenQ: true },
    ],
    'КХ': [{ code: '920.00 (декл. КХ)', period: 'annual', hasMonths: false }],
  },
  statReports: {
    'ОУР (НДС)': [
      { code: '1-Услуги (стат.)', period: 'quarterly', hasMonths: false },
      { code: '11-МП (год. стат.)', period: 'annual', hasMonths: false },
    ],
    'ОУР': [
      { code: '1-Услуги (стат.)', period: 'quarterly', hasMonths: false },
      { code: '11-МП (год. стат.)', period: 'annual', hasMonths: false },
    ],
    'УПРОЩЕНКА': [
      { code: '2МП (стат.)', period: 'quarterly', hasMonths: false },
      { code: '11-МП (год. стат.)', period: 'annual', hasMonths: false },
    ],
    'СНР': [
      { code: '2МП (стат.)', period: 'quarterly', hasMonths: false },
      { code: '11-МП (год. стат.)', period: 'annual', hasMonths: false },
    ],
    'КХ': [],
  },
}

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

function buildReports(companies: Company[], year: number, admin: AdminSettings): { tax: RepEntry[]; stat: RepEntry[] } {
  const QTRS = getQTRS(year)
  const ny = year + 1
  const tax: RepEntry[] = [], stat: RepEntry[] = []
  for (const c of companies) {
    if (c.status !== 'Активная') continue
    if (c.noReports) continue
    const r = c.reg
    const skip = c.skipReports || []
    const extra = c.extraReports || []
    const has200skipped = skip.some(s => s.includes('200'))
    for (const rep of (admin.taxReports[r] || [])) {
      if (skip.includes(rep.code)) continue
      // Отчёт 200 — только если у компании есть сотрудники (или поле не задано — backward compat)
      if (rep.code.includes('200') && c.hasEmployees === false) continue
      if (rep.period === 'annual') {
        tax.push({ co: c.n, reg: r, type: rep.code, q: 'Годовой', due: `${ny}-03-31`, months: null })
      } else {
        for (const qt of QTRS) {
          if ((rep.onlyEvenQ || rep.period === 'semi-annual') && !qt.has910) continue
          const showMonths = rep.hasMonths || (rep.code.includes('910') && has200skipped)
          tax.push({ co: c.n, reg: r, type: rep.code, q: qt.q, due: qt.due200, months: showMonths ? QM[qt.q] : null })
        }
      }
    }
    // Если у компании стоит НДС и режим не ОУР(НДС) — добавляем 300.00 квартально
    if (c.nds && r !== 'ОУР (НДС)' && !skip.includes('300.00 (НДС)')) {
      for (const qt of QTRS) {
        tax.push({ co: c.n, reg: r, type: '300.00 (НДС)', q: qt.q, due: qt.due300, months: null })
      }
    }
    for (const rep of (admin.statReports[r] || [])) {
      if (skip.includes(rep.code)) continue
      if (rep.period === 'annual') {
        stat.push({ co: c.n, reg: r, type: rep.code, q: 'Годовой', due: `${ny}-02-15`, months: null })
      } else if (rep.period === 'monthly') {
        for (const qt of QTRS) {
          stat.push({ co: c.n, reg: r, type: rep.code + ' (ежемес.)', q: qt.q, due: qt.due200, months: QM[qt.q] })
        }
      } else if (rep.period === 'semi-annual') {
        for (const qt of QTRS) {
          if (!qt.has910) continue
          stat.push({ co: c.n, reg: r, type: rep.code, q: qt.q, due: qt.due200, months: null })
        }
      } else {
        for (const qt of QTRS) {
          stat.push({ co: c.n, reg: r, type: rep.code, q: qt.q, due: qt.due200, months: null })
        }
      }
    }
    extra.forEach(e => {
      if (skip.includes(e)) return
      const parts = e.split('|')
      const name = parts[0], period = parts[1] || 'annual', repType = parts[2] || 'tax'
      const isStat = repType === 'stat'
      if (period === 'quarterly') {
        for (const qt of QTRS) { (isStat ? stat : tax).push({ co: c.n, reg: r, type: name, q: qt.q, due: qt.due200, months: null }) }
      } else if (period === 'semi-annual') {
        for (const qt of QTRS) { if (!qt.has910) continue; (isStat ? stat : tax).push({ co: c.n, reg: r, type: name, q: qt.q, due: qt.due200, months: null }) }
      } else if (period === 'monthly') {
        for (const qt of QTRS) { (isStat ? stat : tax).push({ co: c.n, reg: r, type: name + ' (ежемес.)', q: qt.q, due: qt.due200, months: QM[qt.q] }) }
      } else {
        (isStat ? stat : tax).push({ co: c.n, reg: r, type: name, q: 'Годовой', due: `${ny}-03-31`, months: null })
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
  const [repExtra, setRepExtra] = useState<Record<string, { comment: string; cabinet: boolean }>>({})
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
  const [taxYear, setTaxYear] = useState(2026)
  const [taxMonth, setTaxMonth] = useState(6)
  const [taxFreq, setTaxFreq] = useState('')
  const [taxSearch, setTaxSearch] = useState('')
  const [taxCat, setTaxCat] = useState('')
  const [taxReg, setTaxReg] = useState('')
  const [taxSubTab, setTaxSubTab] = useState<'main' | 'stat'>('main')

  // Фильтры отчётов
  const [repYear, setRepYear] = useState(2026)
  const [repQ, setRepQ] = useState('2 квартал')
  const [repReg, setRepReg] = useState('')
  const [repStatus, setRepStatus] = useState('')
  const [repType, setRepType] = useState('')
  const [repSubTab, setRepSubTab] = useState<'tax' | 'stat'>('tax')
  const [taxPaidFilter, setTaxPaidFilter] = useState<'' | 'paid' | 'unpaid'>('')
  const [repSearch, setRepSearch] = useState('')

  // Поиск в уплате налогов
  const [paySearch, setPaySearch] = useState('')

  // Администрирование
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(DEFAULT_ADMIN)
  const [adminSubTab, setAdminSubTab] = useState<'refs' | 'tax' | 'stat'>('refs')

  // Уплата налогов (КПН/ИПН/НДС)
  const [payEntries, setPayEntries] = useState<Record<string, PayEntry>>({})
  const [payYear, setPayYear] = useState(2026)
  const [paySubTab, setPaySubTab] = useState<'kpn' | 'nds'>('kpn')

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
  const [newCoNds, setNewCoNds] = useState(false)
  const [newCoHasEmployees, setNewCoHasEmployees] = useState(false)
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
  const [showAddCo, setShowAddCo] = useState(false)
  const [taxComments, setTaxComments] = useState<Record<string, string>>({})
  const [coPhones, setCoPhones] = useState<Record<string, string>>({})
  const [coTaxContacts, setCoTaxContacts] = useState<Record<string, string>>({})

  // Refs для дебаунса — избегаем race condition при быстром вводе
  const payDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const repExtraDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const taxCmtDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const payEntriesRef = useRef<Record<string, PayEntry>>({})
  const repExtraRef = useRef<Record<string, { comment: string; cabinet: boolean }>>({})
  const taxCommentsRef = useRef<Record<string, string>>({})

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') loadData()
  }, [status])

  // Синхронизируем рефы с текущим состоянием
  useEffect(() => { payEntriesRef.current = payEntries }, [payEntries])
  useEffect(() => { repExtraRef.current = repExtra }, [repExtra])
  useEffect(() => { taxCommentsRef.current = taxComments }, [taxComments])

  useEffect(() => {
    document.body.classList.remove('dark')
    const savedUsers = localStorage.getItem('crm_users')
    if (savedUsers) try { setUsers(JSON.parse(savedUsers)) } catch {}
    const tc = localStorage.getItem('crm_taxComments')
    if (tc) try { setTaxComments(JSON.parse(tc)) } catch {}
    const cp = localStorage.getItem('crm_coPhones')
    if (cp) try { setCoPhones(JSON.parse(cp)) } catch {}
    const ct = localStorage.getItem('crm_coTaxContacts')
    if (ct) try { setCoTaxContacts(JSON.parse(ct)) } catch {}
    const as = localStorage.getItem('crm_adminSettings')
    if (as) try { setAdminSettings(JSON.parse(as)) } catch {}
  }, [])

  async function loadData() {
    setSyncText('Загрузка...'); setSyncCls('syncing')
    try {
      const [coRes, taskRes, tdRes, rdRes, peRes, reRes, crRes, tcRes] = await Promise.all([
        fetch('/api/companies'), fetch('/api/tasks'),
        fetch('/api/taxdone'), fetch('/api/repdone'),
        fetch('/api/payentries'), fetch('/api/repextra'),
        fetch('/api/company-reports'), fetch('/api/taxcomments'),
      ])
      if (taskRes.ok) { const d = await taskRes.json(); if (Array.isArray(d)) setTasks(d) }
      if (tdRes.ok) { const d = await tdRes.json(); if (d && !d.error) setTaxDone(d) }
      if (rdRes.ok) {
        const d = await rdRes.json()
        if (d && !d.error) setRepDone(d)
        else { setSyncText(`Ошибка repDone: ${d?.error || rdRes.status}`); setSyncCls('error') }
      } else { setSyncText(`Ошибка загрузки отчётов (${rdRes.status})`); setSyncCls('error') }
      if (peRes.ok) { const d = await peRes.json(); if (d && !d.error) setPayEntries(d) }
      if (reRes.ok) { const d = await reRes.json(); if (d && !d.error) setRepExtra(d) }
      if (tcRes.ok) { const d = await tcRes.json(); if (d && !d.error) setTaxComments(() => ({ ...JSON.parse(localStorage.getItem('crm_taxComments') || '{}'), ...d })) }
      if (coRes.ok) {
        const cos = await coRes.json()
        if (Array.isArray(cos)) {
          const cr = crRes.ok ? (await crRes.json()) : {}
          setCompanies(cos.map((c: Company) => ({
            ...c,
            skipReports: cr[c.id!]?.skipReports || [],
            extraReports: cr[c.id!]?.extraReports || [],
            bin: cr[c.id!]?.bin || '',
            noReports: !!cr[c.id!]?.noReports,
            hasEmployees: cr[c.id!]?.hasEmployees,
          })))
        }
      }
      if (rdRes.ok) { setSyncText('Синхронизировано ✓'); setSyncCls('') }
    } catch (e) {
      setSyncText(`Ошибка: ${e instanceof Error ? e.message : 'сеть'}`); setSyncCls('error')
    }
  }

  function showToast(msg: string) {
    setToast(msg); setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2500)
  }

  function savePayEntry(key: string, patch: Partial<PayEntry>) {
    const existing: PayEntry = payEntriesRef.current[key] || { amount: '', comment: '', paid: false }
    const updated = { ...existing, ...patch }
    setPayEntries(nd => ({ ...nd, [key]: updated }))

    if (patch.paid !== undefined) {
      // Чекбокс — сохраняем сразу
      fetch('/api/payentries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ key, ...updated }]),
      })
    } else {
      // Текстовые поля — дебаунс 800мс чтобы избежать race condition
      if (payDebounceRef.current[key]) clearTimeout(payDebounceRef.current[key])
      payDebounceRef.current[key] = setTimeout(() => {
        const latest = payEntriesRef.current[key] || updated
        fetch('/api/payentries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{ key, ...latest }]),
        })
      }, 800)
    }
  }

  function saveRepExtra(key: string, patch: Partial<{ comment: string; cabinet: boolean }>) {
    const existing = repExtraRef.current[key] || { comment: '', cabinet: false }
    const updated = { ...existing, ...patch }
    setRepExtra(nd => ({ ...nd, [key]: updated }))

    if (patch.cabinet !== undefined) {
      // Чекбокс — сохраняем сразу
      fetch('/api/repextra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ key, ...updated }]),
      })
    } else {
      // Текстовое поле — дебаунс 800мс
      if (repExtraDebounceRef.current[key]) clearTimeout(repExtraDebounceRef.current[key])
      repExtraDebounceRef.current[key] = setTimeout(() => {
        const latest = repExtraRef.current[key] || updated
        fetch('/api/repextra', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{ key, ...latest }]),
        })
      }, 800)
    }
  }

  function saveTaxDone(nd: Record<string, boolean>, changedKeys?: string[]) {
    setTaxDone(nd)
    const rows = changedKeys
      ? changedKeys.map(k => ({ key: k, done: nd[k] || false }))
      : Object.entries(nd).map(([key, done]) => ({ key, done }))
    fetch('/api/taxdone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) })
  }
  function saveRepDone(nd: Record<string, boolean>, changedKeys?: string[]) {
    setRepDone(nd)
    const rows = changedKeys
      ? changedKeys.map(k => ({ key: k, done: nd[k] || false }))
      : Object.entries(nd).map(([key, done]) => ({ key, done }))
    fetch('/api/repdone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) })
  }

  function saveTaxComment(key: string, val: string) {
    const nc = { ...taxCommentsRef.current, [key]: val }
    setTaxComments(nc)
    localStorage.setItem('crm_taxComments', JSON.stringify(nc))
    // Сохраняем в API с дебаунсом
    if (taxCmtDebounceRef.current[key]) clearTimeout(taxCmtDebounceRef.current[key])
    taxCmtDebounceRef.current[key] = setTimeout(() => {
      const latestVal = taxCommentsRef.current[key] ?? val
      fetch('/api/taxcomments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, val: latestVal }),
      })
    }, 800)
  }
  function saveCoPhone(id: string, val: string) {
    const n = { ...coPhones, [id]: val }
    setCoPhones(n); localStorage.setItem('crm_coPhones', JSON.stringify(n))
  }
  function saveCoTaxContact(id: string, val: string) {
    const n = { ...coTaxContacts, [id]: val }
    setCoTaxContacts(n); localStorage.setItem('crm_coTaxContacts', JSON.stringify(n))
  }
  function saveAdminSettings(s: AdminSettings) {
    setAdminSettings(s); localStorage.setItem('crm_adminSettings', JSON.stringify(s))
  }

  // ─── КОМПАНИИ ───────────────────────────
  const filteredCos = companies.filter(c => {
    if (coQ && !c.n.toLowerCase().includes(coQ.toLowerCase()) && !(c.bin || '').includes(coQ)) return false
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
    const snapshot = editCoData
    const oldName = companies.find(c => c.id === snapshot.id)?.n || ''
    const newName = snapshot.n
    setSyncText('Сохранение...'); setSyncCls('syncing')
    if (snapshot.id) {
      const [res] = await Promise.all([
        fetch('/api/companies', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) }),
        fetch('/api/company-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: snapshot.id, skipReports: snapshot.skipReports || [], extraReports: snapshot.extraReports || [], bin: snapshot.bin || '', noReports: !!snapshot.noReports, hasEmployees: snapshot.hasEmployees }) }),
      ])
      if (res.ok) {
        const updated = await res.json()
        const skip = snapshot.skipReports || []
        const extra = snapshot.extraReports || []
        const bin = snapshot.bin || ''
        const noReports = !!snapshot.noReports
        const hasEmployees = snapshot.hasEmployees
        setCompanies(prev => prev.map(c => c.id === updated.id
          ? { ...updated, skipReports: skip, extraReports: extra, bin, noReports, hasEmployees }
          : c
        ))
      }

      // Если имя изменилось — мигрируем все ключи в базе и в локальном состоянии
      if (oldName && newName && oldName !== newName) {
        fetch('/api/rename-company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldName, newName }),
        })
        // Обновляем локальное состояние немедленно
        const renameKeys = <T>(obj: Record<string, T>): Record<string, T> => {
          const prefix = oldName + '|'
          const result: Record<string, T> = {}
          for (const [k, v] of Object.entries(obj)) {
            result[k.startsWith(prefix) ? newName + '|' + k.slice(prefix.length) : k] = v
          }
          return result
        }
        setTaxDone(prev => renameKeys(prev))
        setRepDone(prev => renameKeys(prev))
        setRepExtra(prev => renameKeys(prev))
        setPayEntries(prev => renameKeys(prev))
        setTaxComments(prev => renameKeys(prev))
      }
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
    const co: Company = { n: newCoName, freq: newCoFreq, reg: newCoReg, cat: newCoCat, b: newCoBase, risk: newCoRisk, nds: newCoNds, status: newCoStatus, skipReports: [], extraReports: [], hasEmployees: newCoHasEmployees }
    setSyncText('Сохранение...'); setSyncCls('syncing')
    const res = await fetch('/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(co) })
    if (res.ok) {
      const saved = await res.json()
      setCompanies(prev => [...prev, { ...saved, hasEmployees: newCoHasEmployees }])
      if (saved.id) await fetch('/api/company-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: saved.id, skipReports: [], extraReports: [], bin: newCoBin || '', noReports: false, hasEmployees: newCoHasEmployees }) })
    }
    setNewCoName('')
    setAddMsg(`✓ "${newCoName}" добавлена! Отчёты созданы по режиму ${newCoReg}.`)
    setTimeout(() => setAddMsg(''), 4000)
    setSyncText('Синхронизировано ✓'); setSyncCls('')
    showToast(`"${newCoName}" добавлена в базу ✓`)
  }

  // ─── РОЛЬ ───────────────────────────────
  const userName = (session?.user as any)?.name || ''
  const userRole = (session?.user as any)?.role || 'employee'
  const isAdmin = userRole === 'admin'

  // ─── ЗАДАЧИ ─────────────────────────────
  const filteredTasks = tasks.filter(t => {
    if (!isAdmin && t.emp !== userName) return false
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
    saveTaxDone(nd, [key])
  }

  // ─── ОТЧЁТЫ ─────────────────────────────
  function toggleRep(key: string) {
    const nd = { ...repDone, [key]: !repDone[key] }
    saveRepDone(nd, [key])
    showToast(nd[key] ? 'Отчёт сдан ✓' : 'Отмечено как не сданный')
  }
  function toggleMonthTax(key: string) {
    const nd = { ...taxDone, [key]: !taxDone[key] }
    saveTaxDone(nd, [key])
  }
  function markAllTaxPaid() {
    const nd = { ...taxDone }
    const keys: string[] = []
    taxAct.forEach(c => { const k = taxKey(c.n, taxMonth - 1); nd[k] = true; keys.push(k) })
    saveTaxDone(nd, keys)
    showToast(`Отмечено ${taxAct.length} компаний ✓`)
  }
  function resetAllTaxPaid() {
    const nd = { ...taxDone }
    const keys: string[] = []
    taxAct.forEach(c => { const k = taxKey(c.n, taxMonth - 1); nd[k] = false; keys.push(k) })
    saveTaxDone(nd, keys)
    showToast(`Сброшено ${taxAct.length} компаний`)
  }
  function exportTaxCSV() {
    const monthName = MN[taxMonth - 1]
    const data = taxAct.map(c => ({
      'Компания': c.n,
      'БИН': c.bin || '',
      'Режим': c.reg,
      'Группа': c.freq,
      'Категория': c.cat,
      'Статус налога': taxDone[taxKey(c.n, taxMonth - 1)] ? 'Уплачен' : 'Не уплачен',
      'Комментарий': taxComments[`${c.n}|${taxYear}-${taxMonth - 1}`] || '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Налоги')
    XLSX.writeFile(wb, `налоги_${monthName}_${taxYear}.xlsx`)
  }
  function exportRepCSV() {
    const list = repSubTab === 'tax' ? taxReps : statReps
    const label = repSubTab === 'tax' ? 'Нал. отчёты' : 'Стат. отчёты'
    const data = list.map(r => {
      const rk = `${r.co}|${r.type}|${r.q}|${repYear}`
      const ex = repExtra[rk] || { comment: '', cabinet: false }
      const done = repDone[rk]
      return {
        'Компания': r.co,
        'Режим': r.reg,
        'Отчёт': r.type,
        'Период': r.q,
        'Срок': r.due,
        'Статус': done ? 'Сдан' : ex.cabinet ? 'Готов' : 'Не сдан',
        'В кабинете': ex.cabinet ? 'Да' : 'Нет',
        'Комментарий': ex.comment || '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 40 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, label)
    XLSX.writeFile(wb, `отчётность_${label}_${repYear}.xlsx`)
  }
  function exportCosCSV() {
    const data = filteredCos.map(c => ({
      'Компания': c.n,
      'БИН': c.bin || '',
      'Режим': c.reg,
      'Группа': c.freq,
      'Категория': c.cat,
      '1С база': c.b === 'БАР' ? 'Есть' : 'Нет',
      'Риск': c.risk,
      'Статус': c.status,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Компании')
    XLSX.writeFile(wb, 'компании.xlsx')
  }
  function exportTasksCSV() {
    const data = filteredTasks.map(t => ({
      'Компания': t.co,
      'Описание': t.desc,
      'Сотрудник': t.emp,
      'Приоритет': t.prio,
      'Срок': t.date,
      'Статус': t.st,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 36 }, { wch: 50 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Задачи')
    XLSX.writeFile(wb, 'задачи.xlsx')
  }
  function exportPayCSV() {
    const periods = getPayPeriods(paySubTab, payYear)
    const active = companies.filter(c => c.status === 'Активная')
    const list = paySubTab === 'nds' ? active.filter(c => c.nds || c.reg === 'ОУР (НДС)' || c.reg.includes('НДС')) : active
    const rows: Record<string, string>[] = []
    for (const p of periods) {
      for (const c of list) {
        const key = `${c.n}|${paySubTab}|${p.q}|${payYear}`
        const e = payEntries[key] || { amount: '', comment: '', paid: false }
        rows.push({
          'Квартал': p.q,
          'Срок уплаты': p.due,
          'Компания': c.n,
          'БИН': c.bin || '',
          'Режим': c.reg,
          'Сумма': e.amount || '0',
          'Комментарий': e.comment || '',
          'Статус': e.paid ? 'Уплачен' : 'Не уплачен',
        })
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    const label = paySubTab === 'kpn' ? 'КПН-ИПН' : 'НДС'
    XLSX.utils.book_append_sheet(wb, ws, label)
    XLSX.writeFile(wb, `уплата_${label}_${payYear}.xlsx`)
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
  const actCos = companies.filter(c => {
    if (taxSearch && !c.n.toLowerCase().includes(taxSearch.toLowerCase())) return false
    if (taxCat && c.cat !== taxCat) return false
    if (taxReg && !c.reg.includes(taxReg)) return false
    return true
  })
  const taxAct = taxFreq ? actCos.filter(c => c.freq === taxFreq) : actCos
  const taxKey = (co: string, m: number) => `${co}|main|${taxYear}-${m}`
  const stTax = {
    count: taxAct.length,
    mainPaid: taxAct.filter(c => taxDone[taxKey(c.n, taxMonth - 1)]).length,
  }
  const taxActFiltered = taxPaidFilter === 'paid'
    ? taxAct.filter(c => taxDone[taxKey(c.n, taxMonth - 1)])
    : taxPaidFilter === 'unpaid'
    ? taxAct.filter(c => !taxDone[taxKey(c.n, taxMonth - 1)])
    : taxAct
  const reps = buildReports(companies, repYear, adminSettings)
  const QLABELS = getQLABELS(repYear)
  const repKey = (r: RepEntry) => `${r.co}|${r.type}|${r.q}|${repYear}`
  function applyRepFilters(list: RepEntry[]) {
    return list.filter(r => {
      if (repQ && r.q !== repQ) return false
      if (repReg && r.reg !== repReg) return false
      if (repType && !r.type.startsWith(repType + '.')) return false
      if (repStatus === 'done' && !repDone[repKey(r)]) return false
      if (repStatus === 'pending' && (repDone[repKey(r)] || repExtra[repKey(r)]?.cabinet)) return false
      if (repStatus === 'ready' && (repDone[repKey(r)] || !repExtra[repKey(r)]?.cabinet)) return false
      if (repStatus === 'overdue' && (repDone[repKey(r)] || dl(r.due) >= 0)) return false
      if (repSearch && !r.co.toLowerCase().includes(repSearch.toLowerCase())) return false
      return true
    })
  }
  const repTypeCodes = repSubTab === 'tax'
    ? [...new Set(reps.tax.map(r => r.type.split('.')[0]))].sort()
    : [...new Set(reps.stat.map(r => r.type.split('.')[0]))].sort()
  const taxReps = applyRepFilters(reps.tax)
  const statReps = applyRepFilters(reps.stat)
  const cosWithReports = new Set([...reps.tax.map(r => r.co), ...reps.stat.map(r => r.co)])
  const cosWithoutReports = companies.filter(c =>
    (c.noReports || (c.status === 'Активная' && !cosWithReports.has(c.n))) &&
    (!repSearch || c.n.toLowerCase().includes(repSearch.toLowerCase()))
  )
  const stRep = {
    taxTotal: taxReps.length,
    taxDone: taxReps.filter(r => repDone[repKey(r)]).length,
    statTotal: statReps.length,
    statDone: statReps.filter(r => repDone[repKey(r)]).length,
    overdue: taxReps.filter(r => !repDone[repKey(r)] && dl(r.due) < 0).length,
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
          {([['co', 'ti-building', 'Компании'], ['tasks', 'ti-checklist', 'Задачи'], ['tax', 'ti-cash', 'Налоги'], ['rep', 'ti-file-check', 'Отчётность'], ['pay', 'ti-coin', 'Уплата налогов']] as [TabId, string, string][]).map(([id, icon, label]) => (
            <button key={id} className={`crm-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              <i className={`ti ${icon}`}></i>{label}
            </button>
          ))}
          {isAdmin && (
            <button className={`crm-tab${tab === 'admin' ? ' active' : ''}`} onClick={() => setTab('admin')}>
              <i className="ti ti-settings"></i>Администрирование
            </button>
          )}
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
            {tab === 'co' ? 'Компании' : tab === 'tasks' ? 'Задачи' : tab === 'tax' ? 'Налоги' : tab === 'rep' ? 'Отчётность' : tab === 'pay' ? 'Уплата налогов' : 'Администрирование'}
          </span>
          <div className="crm-topbar-actions">
            <span className={`sync-status ${syncCls}`} style={{ cursor: syncCls === 'error' ? 'pointer' : 'default' }} onClick={() => syncCls === 'error' && loadData()} title={syncCls === 'error' ? 'Нажмите для повтора' : undefined}>{syncText}{syncCls === 'error' ? ' 🔄' : ''}</span>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="srow" style={{ flex: 1, margin: 0 }}>
            <div className="stat s-indigo"><div className="sl">Всего</div><div className="sv">{stCo.total}</div></div>
            <div className="stat s-sky"><div className="sl">Ежедневные</div><div className="sv">{stCo.daily}</div></div>
            <div className="stat s-sky"><div className="sl">Раз в месяц</div><div className="sv">{stCo.monthly}</div></div>
            <div className="stat s-purple"><div className="sl">Квартальные</div><div className="sv">{stCo.quarterly}</div></div>
            <div className="stat s-amber"><div className="sl">Разовые</div><div className="sv">{stCo.once}</div></div>
            <div className="stat s-red"><div className="sl">На закрытие</div><div className="sv red">{stCo.closing}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 12, flexShrink: 0 }}>
            <button className="btn-sm" onClick={exportCosCSV} style={{ background: '#fff', color: '#6366f1', border: '1px solid #c7d2fe', whiteSpace: 'nowrap' }}>⬇ Excel</button>
            <button className="btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowAddCo(v => !v)}>
              <i className="ti ti-plus" style={{ marginRight: 4 }}></i>{showAddCo ? 'Скрыть' : 'Добавить компанию'}
            </button>
          </div>
        </div>

        {/* Форма добавления (показывается по кнопке) */}
        {showAddCo && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 14, boxShadow: '0 1px 3px rgba(15,23,42,.06)' }}>
            <div className="ftitle" style={{ marginBottom: 12 }}>Новая компания</div>
            <div className="fr">
              <div className="fg"><label>Наименование *</label><input type="text" placeholder="ТОО / ИП ..." value={newCoName} onChange={e => setNewCoName(e.target.value)} /></div>
              <div className="fg"><label>БИН / ИИН</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="text" placeholder="12 цифр" maxLength={12} value={newCoBin} onChange={e => setNewCoBin(e.target.value.replace(/\D/g, ''))} style={{ flex: 1 }} />
                  <button type="button" className="btn" style={{ padding: '4px 12px', fontSize: 11, whiteSpace: 'nowrap' }} onClick={lookupBin} disabled={newCoBinLoading}>{newCoBinLoading ? '...' : 'Найти'}</button>
                </div>
              </div>
            </div>
            <div className="fr3">
              <div className="fg"><label>Режим *</label>
                <input list="reg-list" placeholder="ОУР, УПРОЩЕНКА..." value={newCoReg} onChange={e => setNewCoReg(e.target.value)} />
                <datalist id="reg-list">{adminSettings.regimes.map(r => <option key={r} value={r} />)}</datalist>
              </div>
              <div className="fg"><label>Группа *</label>
                <input list="freq-list" placeholder="Ежедневная..." value={newCoFreq} onChange={e => setNewCoFreq(e.target.value)} />
                <datalist id="freq-list">{adminSettings.groups.map(g => <option key={g} value={g} />)}</datalist>
              </div>
              <div className="fg"><label>Категория</label>
                <input list="cat-list" placeholder="КАФЕШКИ, ИП-ЖОО..." value={newCoCat} onChange={e => setNewCoCat(e.target.value)} />
                <datalist id="cat-list">{adminSettings.categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
            </div>
            <div className="fr">
              <div className="fg"><label>1С база</label>
                <select value={newCoBase} onChange={e => setNewCoBase(e.target.value)}><option value="БАР">ЕСТЬ</option><option value="ЖОҚ">НЕТ</option></select>
              </div>
              <div className="fg"><label>Риск</label>
                <select value={newCoRisk} onChange={e => setNewCoRisk(e.target.value)}>{adminSettings.risks.map(r => <option key={r}>{r}</option>)}</select>
              </div>
              <div className="fg"><label>Статус</label>
                <select value={newCoStatus} onChange={e => setNewCoStatus(e.target.value)}>
                  {adminSettings.statuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, margin: '6px 0 10px' }}>
              <div style={{ flex: 1, padding: '8px 12px', background: newCoNds ? '#eff6ff' : '#f8fafc', border: `1px solid ${newCoNds ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="new-co-nds" checked={newCoNds} onChange={e => setNewCoNds(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#4f46e5', cursor: 'pointer' }} />
                <label htmlFor="new-co-nds" style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, color: newCoNds ? '#1d4ed8' : '#475569' }}>
                  Плательщик НДС {newCoNds ? '→ 300.00 (кварт.)' : ''}
                </label>
              </div>
              <div style={{ flex: 1, padding: '8px 12px', background: newCoHasEmployees ? '#f0fdf4' : '#f8fafc', border: `1px solid ${newCoHasEmployees ? '#86efac' : '#e2e8f0'}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="new-co-emp" checked={newCoHasEmployees} onChange={e => setNewCoHasEmployees(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#16a34a', cursor: 'pointer' }} />
                <label htmlFor="new-co-emp" style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, color: newCoHasEmployees ? '#15803d' : '#475569' }}>
                  Есть сотрудники {newCoHasEmployees ? '→ 200.00 (кварт.)' : ''}
                </label>
              </div>
            </div>
            <div className="ibox" style={{ marginBottom: 10 }}>
              {newCoReg ? (({ 'ОУР': '200.00 (кварт.) · 100.00 (год.)', 'УПРОЩЕНКА': '910.00 (2 и 4 кв.) · 200.00 (кварт.)', 'СНР': '910.00 (2 и 4 кв.) · 200.00 (кварт.)', 'КХ': '920.00 (год.)' }[newCoReg] || newCoReg) + (newCoNds ? ' · 300.00 НДС (кварт.)' : '')) : 'Выберите режим — отчёты создадутся автоматически'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => { addCo(); setShowAddCo(false) }}>Добавить</button>
              <button className="btn-warn" style={{ background: 'transparent' }} onClick={() => setShowAddCo(false)}>Отмена</button>
            </div>
            {addMsg && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 8, fontWeight: 500 }}>{addMsg}</div>}
          </div>
        )}

        <div className="ff">
          <input type="text" placeholder="Поиск компании..." value={coQ} onChange={e => setCoQ(e.target.value)} />
          <select value={coFreq} onChange={e => setCoFreq(e.target.value)}>
            <option value="">Все группы</option>
            {adminSettings.groups.map(g => <option key={g}>{g}</option>)}
          </select>
          <select value={coCat} onChange={e => setCoCat(e.target.value)}>
            <option value="">Все категории</option>
            {adminSettings.categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={coReg} onChange={e => setCoReg(e.target.value)}>
            <option value="">Все режимы</option>
            {adminSettings.regimes.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="tw">
          <table>
            <colgroup><col style={{ width: '28%' }} /><col style={{ width: '13%' }} /><col style={{ width: '14%' }} /><col style={{ width: '15%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /></colgroup>
            <thead><tr><th>Организация</th><th>Группа</th><th>Режим</th><th>Категория</th><th>1С база</th><th>Риск</th><th style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {filteredCos.map(c => (
                <tr key={c.id || c.n} style={{ cursor: 'pointer' }} onClick={() => { setEditCoData({ ...c }); setEditCoIdx(companies.findIndex(x => x.n === c.n)) }}>
                  <td style={{ maxWidth: 180 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.n}>{c.n}</div>
                    {c.bin && <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: 0.5 }}>{c.bin}</div>}
                  </td>
                  <td><span className={`b bfreq-${(c.freq||'').split(' ')[0].toLowerCase().replace(/[^a-zа-я]/g,'')}`} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 99, fontSize: 10, padding: '2px 7px', whiteSpace: 'nowrap' as const }}>{c.freq}</span></td>
                  <td>{regBadge(c.reg)}</td>
                  <td style={{ fontSize: 10.5, color: '#64748b' }}>{c.cat}</td>
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
        {!isAdmin && <div className="ibox">Показаны только ваши задачи. Задачи других сотрудников видит только администратор.</div>}
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
          <button className="btn-sm" onClick={exportTasksCSV} style={{ background: '#fff', color: '#6366f1', border: '1px solid #c7d2fe', whiteSpace: 'nowrap' }}>⬇ Excel</button>
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
          <div className="stat s-indigo" style={{ cursor: 'pointer' }} onClick={() => setTaxPaidFilter('')}>
            <div className="sl">Компаний</div><div className="sv">{stTax.count}</div>
          </div>
          <div className="stat s-green" style={{ cursor: 'pointer', ...(taxPaidFilter === 'paid' ? { outline: '2px solid #16a34a', outlineOffset: -2 } : {}) }} onClick={() => setTaxPaidFilter(f => f === 'paid' ? '' : 'paid')}>
            <div className="sl">Уплачено {taxPaidFilter === 'paid' ? '▼' : ''}</div><div className="sv green">{stTax.mainPaid}</div>
          </div>
          <div className="stat s-red" style={{ cursor: 'pointer', ...(taxPaidFilter === 'unpaid' ? { outline: '2px solid #dc2626', outlineOffset: -2 } : {}) }} onClick={() => setTaxPaidFilter(f => f === 'unpaid' ? '' : 'unpaid')}>
            <div className="sl">Не уплачено {taxPaidFilter === 'unpaid' ? '▼' : ''}</div><div className="sv red">{stTax.count - stTax.mainPaid}</div>
          </div>
        </div>

        {/* Мини-анализ рисков */}
        {stTax.count - stTax.mainPaid > 0 && (() => {
          const unpaid = taxAct.filter(c => !taxDone[taxKey(c.n, taxMonth - 1)])
          const high = unpaid.filter(c => c.risk === 'высокая')
          const mid = unpaid.filter(c => c.risk === 'средняя')
          const low = unpaid.filter(c => c.risk === 'низкая')
          return (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#c2410c' }}>⚠️ Не уплачено: {unpaid.length}</span>
                {high.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#991b1b', background: '#fee2e2', borderRadius: 6, padding: '2px 8px', border: '1px solid #fecaca' }}>🔴 Высокий риск: {high.length}</span>}
                {mid.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e', background: '#fef3c7', borderRadius: 6, padding: '2px 8px', border: '1px solid #fde68a' }}>🟡 Средний: {mid.length}</span>}
                {low.length > 0 && <span style={{ fontSize: 11, color: '#065f46', background: '#d1fae5', borderRadius: 6, padding: '2px 8px', border: '1px solid #a7f3d0' }}>🟢 Низкий: {low.length}</span>}
              </div>
              {high.length > 0 && (
                <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                  {high.map(c => (
                    <span key={c.n} style={{ fontSize: 10.5, background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '2px 8px', border: '1px solid #fecaca', fontWeight: 500 }}>
                      🔴 {c.n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        <div className="ff" style={{ marginBottom: 6 }}>
          <input type="text" placeholder="Поиск компании..." value={taxSearch} onChange={e => setTaxSearch(e.target.value)} />
          <select value={taxYear} onChange={e => setTaxYear(+e.target.value)}>
            <option value={2025}>2025 год</option>
            <option value={2026}>2026 год</option>
            <option value={2027}>2027 год</option>
          </select>
          <select value={taxMonth} onChange={e => setTaxMonth(+e.target.value)}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <option key={m} value={m}>За {MN[m === 1 ? 12 : m - 1]} {m === 1 ? taxYear - 1 : taxYear} → до 25 {MN[m]}</option>
            ))}
          </select>
          <select value={taxFreq} onChange={e => setTaxFreq(e.target.value)}>
            <option value="">Все группы</option>
            <option value="Ежедневная">Ежедневные</option>
            <option value="Раз в месяц">Раз в месяц</option>
            <option value="Квартальная">Квартальные</option>
            <option value="Разовая">Разовые</option>
            <option value="На закрытие">На закрытие</option>
          </select>
          <select value={taxCat} onChange={e => setTaxCat(e.target.value)}>
            <option value="">Все категории</option>
            {adminSettings.categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={taxReg} onChange={e => setTaxReg(e.target.value)}>
            <option value="">Все режимы</option>
            {adminSettings.regimes.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>Показано: {taxActFiltered.length} компаний{taxPaidFilter ? ` (фильтр: ${taxPaidFilter === 'paid' ? 'уплачено' : 'не уплачено'})` : ''}</span>
          <button className="btn-sm" onClick={markAllTaxPaid} style={{ marginLeft: 'auto' }}>✓ Отметить всех уплачено</button>
          <button className="btn-sm" onClick={resetAllTaxPaid} style={{ background: '#fff', color: '#dc2626', border: '1px solid #fecaca' }}>✕ Сбросить</button>
          <button className="btn-sm" onClick={exportTaxCSV} style={{ background: '#fff', color: '#6366f1', border: '1px solid #c7d2fe' }}>⬇ Excel</button>
        </div>
        <TaxSection companies={taxActFiltered} taxDone={taxDone} taxMonth={taxMonth} taxYear={taxYear} taxFreq={taxFreq} onToggle={toggleTax} taxComments={taxComments} onComment={saveTaxComment} />
      </div>

      {/* ═══════════════ ОТЧЁТНОСТЬ ═══════════════ */}
      <div className={`crm-sec${tab === 'rep' ? ' active' : ''}`}>
        <div className="srow">
          {repSubTab === 'tax' ? (<>
            <div className="stat s-indigo"><div className="sl">Нал. всего</div><div className="sv">{stRep.taxTotal}</div></div>
            <div className="stat s-green" style={{ cursor: 'pointer', ...(repStatus === 'done' ? { outline: '2px solid #16a34a', outlineOffset: -2 } : {}) }} onClick={() => setRepStatus(s => s === 'done' ? '' : 'done')}>
              <div className="sl">Нал. сдано {repStatus === 'done' ? '▼' : ''}</div><div className="sv green">{stRep.taxDone}</div>
            </div>
            <div className="stat s-red" style={{ cursor: 'pointer', ...(repStatus === 'pending' ? { outline: '2px solid #dc2626', outlineOffset: -2 } : {}) }} onClick={() => setRepStatus(s => s === 'pending' ? '' : 'pending')}>
              <div className="sl">Нал. не сдано {repStatus === 'pending' ? '▼' : ''}</div><div className="sv red">{stRep.taxTotal - stRep.taxDone}</div>
            </div>
            <div className="stat s-red" style={{ cursor: 'pointer', borderLeft: '3px solid #b91c1c', ...(repStatus === 'overdue' ? { outline: '2px solid #b91c1c', outlineOffset: -2 } : {}) }} onClick={() => setRepStatus(s => s === 'overdue' ? '' : 'overdue')}>
              <div className="sl">Просрочено {repStatus === 'overdue' ? '▼' : ''}</div><div className="sv red">{stRep.overdue}</div>
            </div>
          </>) : (<>
            <div className="stat s-purple"><div className="sl">Стат. всего</div><div className="sv">{stRep.statTotal}</div></div>
            <div className="stat s-green" style={{ cursor: 'pointer', ...(repStatus === 'done' ? { outline: '2px solid #16a34a', outlineOffset: -2 } : {}) }} onClick={() => setRepStatus(s => s === 'done' ? '' : 'done')}>
              <div className="sl">Стат. сдано {repStatus === 'done' ? '▼' : ''}</div><div className="sv green">{stRep.statDone}</div>
            </div>
            <div className="stat s-red" style={{ cursor: 'pointer', ...(repStatus === 'pending' ? { outline: '2px solid #dc2626', outlineOffset: -2 } : {}) }} onClick={() => setRepStatus(s => s === 'pending' ? '' : 'pending')}>
              <div className="sl">Стат. не сдано {repStatus === 'pending' ? '▼' : ''}</div><div className="sv red">{stRep.statTotal - stRep.statDone}</div>
            </div>
          </>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' as const }}>
          <div className="stabs" style={{ marginBottom: 0 }}>
            <button className={`stab${repSubTab === 'tax' ? ' active' : ''}`} onClick={() => { setRepSubTab('tax'); setRepType('') }}>Налоговые отчёты</button>
            <button className={`stab${repSubTab === 'stat' ? ' active' : ''}`} onClick={() => { setRepSubTab('stat'); setRepType('') }}>Статистические отчёты</button>
          </div>
          <select value={repYear} onChange={e => setRepYear(+e.target.value)} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#111827' }}>
            <option value={2025}>2025 год</option>
            <option value={2026}>2026 год</option>
            <option value={2027}>2027 год</option>
          </select>
          <button className="btn-sm" onClick={exportRepCSV} style={{ marginLeft: 'auto', background: '#fff', color: '#6366f1', border: '1px solid #c7d2fe' }}>⬇ Excel</button>
        </div>
        <div className="ff" style={{ marginBottom: 9 }}>
          <input type="text" placeholder="Поиск компании..." value={repSearch} onChange={e => setRepSearch(e.target.value)} style={{ flex: 2, minWidth: 180 }} />
          <select value={repQ} onChange={e => setRepQ(e.target.value)}>
            <option value="">Все кварталы</option>
            <option>1 квартал</option><option>2 квартал</option><option>3 квартал</option><option>4 квартал</option><option>Годовой</option>
          </select>
          <select value={repReg} onChange={e => setRepReg(e.target.value)}>
            <option value="">Все режимы</option>
            {adminSettings.regimes.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={repType} onChange={e => setRepType(e.target.value)}>
            <option value="">Все отчёты</option>
            {repTypeCodes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={repStatus} onChange={e => setRepStatus(e.target.value)}>
            <option value="">Все статусы</option>
            <option value="pending">Не сдан</option><option value="ready">Готов</option><option value="done">Сдан</option>
            <option value="overdue">Просрочено</option>
            <option value="no-reports">Без отчёта</option>
          </select>
        </div>
        {repStatus === 'no-reports' ? (
          <div>
            {cosWithoutReports.length === 0 ? (
              <div className="empty">Все активные компании имеют отчёты</div>
            ) : (
              <div className="q-block">
                <div className="q-head">
                  <span>Компании без отчётов</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 400 }}>{cosWithoutReports.length} компаний</span>
                </div>
                <div className="q-table">
                  <table>
                    <thead><tr><th>Организация</th><th>Режим</th><th>Группа</th></tr></thead>
                    <tbody>
                      {cosWithoutReports.map((c, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500, color: '#4f46e5', cursor: 'pointer' }} onClick={() => { setEditCoData({ ...c }); setEditCoIdx(companies.findIndex(x => x.n === c.n)) }}>{c.n}</td>
                          <td>{regBadge(c.reg)}</td>
                          <td style={{ fontSize: 11, color: '#64748b' }}>{c.freq}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
        <ReportsSection
          reports={repSubTab === 'tax' ? reps.tax : reps.stat}
          repDone={repDone}
          taxDone={taxDone}
          repYear={repYear}
          repQ={repQ} repReg={repReg} repStatus={repStatus} repSearch={repSearch} repType={repType}
          repExtra={repExtra}
          onToggleRep={toggleRep}
          onToggleMonthTax={toggleMonthTax}
          onSaveRepExtra={saveRepExtra}
          onEditCompany={(name) => { const co = companies.find(c => c.n === name); if (co) { setEditCoData({ ...co }); setEditCoIdx(companies.findIndex(c => c.n === name)) } }}
          QLABELS={QLABELS}
        />
        )}
      </div>


      {/* ═══════════════ УПЛАТА НАЛОГОВ ═══════════════ */}
      <div className={`crm-sec${tab === 'pay' ? ' active' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button className="btn-sm" onClick={exportPayCSV} style={{ background: '#fff', color: '#6366f1', border: '1px solid #c7d2fe' }}>⬇ Excel</button>
        </div>
        <PaySection
          companies={companies}
          payEntries={payEntries}
          payYear={payYear}
          paySubTab={paySubTab}
          paySearch={paySearch}
          onYearChange={setPayYear}
          onSubTabChange={setPaySubTab}
          onSearchChange={setPaySearch}
          onSave={savePayEntry}
        />
      </div>

      {/* ═══════════════ АДМИНИСТРИРОВАНИЕ ═══════════════ */}
      {isAdmin && (
        <div className={`crm-sec${tab === 'admin' ? ' active' : ''}`}>
          <AdminSection adminSettings={adminSettings} onSave={saveAdminSettings} />
        </div>
      )}

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
            <div className="fg"><label>БИН / ИИН</label>
              <input type="text" placeholder="123456789012" maxLength={12} value={editCoData.bin || ''} onChange={e => setEditCoData(p => p ? { ...p, bin: e.target.value } : p)} style={{ fontFamily: 'monospace', letterSpacing: 1 }} />
            </div>
            <div className="fr">
              <div className="fg"><label>Режим</label>
                <input list="e-reg-list" value={editCoData.reg} onChange={e => setEditCoData(p => p ? { ...p, reg: e.target.value } : p)} />
                <datalist id="e-reg-list">{adminSettings.regimes.map(r => <option key={r} value={r} />)}</datalist>
              </div>
              <div className="fg"><label>Группа</label>
                <input list="e-freq-list" value={editCoData.freq} onChange={e => setEditCoData(p => p ? { ...p, freq: e.target.value } : p)} />
                <datalist id="e-freq-list">{adminSettings.groups.map(g => <option key={g} value={g} />)}</datalist>
              </div>
            </div>
            <div className="fr">
              <div className="fg"><label>Категория</label>
                <input list="e-cat-list" value={editCoData.cat} onChange={e => setEditCoData(p => p ? { ...p, cat: e.target.value } : p)} />
                <datalist id="e-cat-list">{adminSettings.categories.map(c => <option key={c} value={c} />)}</datalist>
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
                  {adminSettings.risks.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="fg"><label>Статус</label>
                <select value={editCoData.status} onChange={e => setEditCoData(p => p ? { ...p, status: e.target.value } : p)}>
                  {adminSettings.statuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, margin: '6px 0 8px' }}>
              <div style={{ flex: 1, padding: '8px 12px', background: editCoData.nds ? '#eff6ff' : '#f8fafc', border: `1px solid ${editCoData.nds ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="edit-co-nds" checked={!!editCoData.nds} onChange={e => setEditCoData(p => {
                  if (!p) return p
                  const checked = e.target.checked
                  const newSkip = checked ? (p.skipReports || []).filter(s => !s.includes('300')) : (p.skipReports || [])
                  return { ...p, nds: checked, skipReports: newSkip }
                })} style={{ width: 16, height: 16, accentColor: '#4f46e5', cursor: 'pointer' }} />
                <label htmlFor="edit-co-nds" style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, color: editCoData.nds ? '#1d4ed8' : '#475569' }}>
                  Плательщик НДС {editCoData.nds ? '→ 300.00' : ''}
                </label>
              </div>
              <div style={{ flex: 1, padding: '8px 12px', background: editCoData.hasEmployees ? '#f0fdf4' : '#f8fafc', border: `1px solid ${editCoData.hasEmployees ? '#86efac' : '#e2e8f0'}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="edit-co-emp" checked={editCoData.hasEmployees !== false} onChange={e => setEditCoData(p => {
                  if (!p) return p
                  const checked = e.target.checked
                  // При включении — убираем 200 из skipReports, чтобы снять скрытие
                  const newSkip = checked ? (p.skipReports || []).filter(s => !s.includes('200')) : (p.skipReports || [])
                  return { ...p, hasEmployees: checked, skipReports: newSkip }
                })} style={{ width: 16, height: 16, accentColor: '#16a34a', cursor: 'pointer' }} />
                <label htmlFor="edit-co-emp" style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, color: editCoData.hasEmployees !== false ? '#15803d' : '#475569' }}>
                  Есть сотрудники {editCoData.hasEmployees !== false ? '→ 200.00' : '— без 200'}
                </label>
              </div>
            </div>
            <div className="fr">
              <div className="fg"><label>📞 Телефон директора</label>
                <input type="text" placeholder="+7 ..." value={coPhones[editCoData.id || ''] || ''} onChange={e => saveCoPhone(editCoData.id || '', e.target.value)} />
              </div>
              <div className="fg"><label>🏛 Контакт налоговой</label>
                <input type="text" placeholder="Телефон / имя инспектора" value={coTaxContacts[editCoData.id || ''] || ''} onChange={e => saveCoTaxContact(editCoData.id || '', e.target.value)} />
              </div>
            </div>
            <div style={{ margin: '10px 0 4px', padding: '8px 12px', background: editCoData.noReports ? '#fff5f5' : '#f8fafc', border: `1px solid ${editCoData.noReports ? '#fecaca' : '#e2e8f0'}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="no-reports-toggle" checked={!!editCoData.noReports} onChange={e => setEditCoData(p => p ? { ...p, noReports: e.target.checked } : p)} style={{ width: 16, height: 16, accentColor: '#ef4444', cursor: 'pointer' }} />
              <label htmlFor="no-reports-toggle" style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, color: editCoData.noReports ? '#dc2626' : '#475569' }}>
                Отчёты не сдаём
              </label>
              {editCoData.noReports && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>— компания будет в списке «Без отчёта»</span>}
            </div>
            {!editCoData.noReports && <EditCoReports company={editCoData} onChange={setEditCoData} adminSettings={adminSettings} />}
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
function TaxSection({ companies, taxDone, taxMonth, taxYear, taxFreq, onToggle, taxComments, onComment }: {
  companies: Company[]; taxDone: Record<string, boolean>; taxMonth: number; taxYear: number; taxFreq: string
  onToggle: (key: string) => void; taxComments: Record<string, string>; onComment: (key: string, val: string) => void
}) {
  const MN = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  const prevMonth = taxMonth === 1 ? 12 : taxMonth - 1
  const prevYear = taxMonth === 1 ? taxYear - 1 : taxYear
  const mk = (co: string) => `${co}|main|${taxYear}-${taxMonth - 1}`
  const grps = [
    { label: 'Ежедневные', freq: 'Ежедневная', color: '#1d4ed8', bg: '#eff6ff' },
    { label: 'Раз в месяц', freq: 'Раз в месяц', color: '#065f46', bg: '#d1fae5' },
    { label: 'Квартальные', freq: 'Квартальная', color: '#6d28d9', bg: '#ede9fe' },
    { label: 'Разовые', freq: 'Разовая', color: '#92400e', bg: '#fef3c7' },
    { label: 'На закрытие', freq: 'На закрытие', color: '#7f1d1d', bg: '#fee2e2' },
  ]
  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, padding: '6px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
        Период: <strong>за {MN[prevMonth]} {prevYear}</strong> — налоги уплатить до <strong>25 {MN[taxMonth]} {taxYear}</strong>
      </div>
      {grps.map(g => {
        if (taxFreq && taxFreq !== g.freq) return null
        const rows = companies.filter(c => c.freq === g.freq)
        if (!rows.length) return null
        const dn = rows.filter(c => taxDone[mk(c.n)]).length
        return (
          <div key={g.freq} className="tgrp">
            <div className="tgrp-t">
              <span style={{ background: g.bg, color: g.color, borderRadius: 99, fontSize: 10, padding: '2px 8px', fontWeight: 600 }}>{g.label}</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>{dn}</span>
              <span style={{ color: '#64748b' }}>/{rows.length}</span>
              <span style={{ color: '#94a3b8', fontWeight: 400 }}>· до 25 {MN[taxMonth]}</span>
            </div>
            {rows.map(c => {
              const key = mk(c.n)
              const done = taxDone[key]
              const cmtKey = `${c.n}|cmt|${taxYear}-${taxMonth - 1}`
              const cmt = taxComments[cmtKey] || ''
              return (
                <div key={c.n} className="trow" style={{ flexWrap: 'wrap' as const, gap: 4 }}>
                  <input type="checkbox" className="chk" checked={!!done} onChange={() => onToggle(key)} />
                  {regBadge(c.reg)}
                  <div className={`tname${done ? ' sk' : ''}`} style={{ marginLeft: 4 }}>{c.n}</div>
                  <div className="ttypes">{getTaxTypes(c.reg).join(' · ')}</div>
                  <span className={`b ${done ? 'bg' : 'ba'}`} style={{ marginLeft: 'auto' }}>{done ? 'уплачен' : 'до 25-го'}</span>
                  <input
                    type="text" value={cmt}
                    onChange={e => onComment(cmtKey, e.target.value)}
                    placeholder="Комментарий (блок счёта, нет денег...)"
                    style={{ width: '100%', fontSize: 11, padding: '3px 8px', border: '1px solid #e2e8f0', borderRadius: 5, color: '#b45309', background: cmt ? '#fffbeb' : '#f8fafc', marginTop: 2 }}
                  />
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
function ReportsSection({ reports, repDone, taxDone, repYear, repQ, repReg, repStatus, repSearch, repType, repExtra, onToggleRep, onToggleMonthTax, onSaveRepExtra, onEditCompany, QLABELS }: {
  reports: RepEntry[]; repDone: Record<string, boolean>; taxDone: Record<string, boolean>
  repYear: number; repQ: string; repReg: string; repStatus: string; repSearch?: string; repType?: string
  repExtra: Record<string, { comment: string; cabinet: boolean }>
  onToggleRep: (key: string) => void; onToggleMonthTax: (key: string) => void
  onSaveRepExtra: (key: string, patch: Partial<{ comment: string; cabinet: boolean }>) => void
  onEditCompany: (name: string) => void; QLABELS: Record<string, string>
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  function dlLocal(d: string) {
    const x = new Date(d); x.setHours(0, 0, 0, 0)
    return Math.round((x.getTime() - today.getTime()) / 86400000)
  }

  const rKey = (r: RepEntry) => `${r.co}|${r.type}|${r.q}|${repYear}`
  const mKey = (co: string, m: number) => `${co}|main|${repYear}-${m}`
  const list = reports.filter(r => {
    if (repReg && r.reg !== repReg) return false
    if (repQ && r.q !== repQ) return false
    if (repType && !r.type.startsWith(repType + '.')) return false
    if (repStatus === 'done' && !repDone[rKey(r)]) return false
    if (repStatus === 'pending' && (repDone[rKey(r)] || repExtra[rKey(r)]?.cabinet)) return false
    if (repStatus === 'ready' && (repDone[rKey(r)] || !repExtra[rKey(r)]?.cabinet)) return false
    if (repSearch && !r.co.toLowerCase().includes(repSearch.toLowerCase())) return false
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
        const dn = items.filter(r => repDone[rKey(r)]).length
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
                    <th style={{ width: '20%' }}>Организация</th>
                    <th style={{ width: '10%' }}>Режим</th>
                    <th style={{ width: '10%' }}>Отчёт</th>
                    <th style={{ width: '7%' }} className="center">Срок</th>
                    <th style={{ width: '8%' }} className="center">Статус</th>
                    <th style={{ width: '8%' }} className="center">В кабинете</th>
                    <th style={{ width: '18%' }}>Комментарий</th>
                    {months.map(m => <th key={m} style={{ width: '7%' }} className="center">{MN_S[m]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => {
                    const rowKey = rKey(r)
                    const done = repDone[rowKey]
                    const d = dlLocal(r.due)
                    const dt = done ? '✓ сдан' : d < 0 ? `просроч.${Math.abs(d)}д` : `${d} дн.`
                    const tc = r.type.includes('910') ? 'bt' : r.type.includes('300') ? 'br' : r.type.includes('200') ? 'bp' : 'ba'
                    const sk = done ? { textDecoration: 'line-through' as const, color: '#b4b2a9' } : {}
                    const extra = repExtra[rowKey] || { comment: '', cabinet: false }
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', ...sk }} title={`${r.co} — нажмите для редактирования`}>
                          <span style={{ cursor: 'pointer', borderBottom: '1px dashed #c7d2fe', color: done ? '#b4b2a9' : '#4f46e5' }} onClick={() => onEditCompany(r.co)}>{r.co}</span>
                        </td>
                        <td>{regBadge(r.reg)}</td>
                        <td>
                          <span className={`b ${tc}`} style={{ fontSize: 9 }}>{r.type.split(' ')[0]}</span>{' '}
                          <span style={{ fontSize: 10, color: '#888780' }}>{r.type.split(' ').slice(1).join(' ')}</span>
                        </td>
                        <td className="center"><span style={{ fontSize: 10, color: '#888780' }}>{r.due.slice(5)}</span></td>
                        <td className="center">
                          <div
                            className={`tax-cell ${done ? 'tax-paid' : extra.cabinet ? '' : 'tax-unpaid'}`}
                            onClick={() => onToggleRep(rowKey)}
                            style={{
                              cursor: 'pointer',
                              ...((!done && extra.cabinet) ? { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' } : {}),
                            }}
                          >
                            {done ? '✓ сдан' : extra.cabinet ? '📋 готов' : '✗ не сдан'}
                          </div>
                        </td>
                        <td className="center">
                          <input
                            type="checkbox"
                            checked={extra.cabinet}
                            onChange={e => onSaveRepExtra(rowKey, { cabinet: e.target.checked })}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4f46e5' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={extra.comment}
                            placeholder="Заметка..."
                            onChange={e => onSaveRepExtra(rowKey, { comment: e.target.value })}
                            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 6px', fontSize: 11, background: 'transparent', color: 'inherit' }}
                          />
                        </td>
                        {months.map(m => {
                          if (!r.months) return <td key={m} className="center"><span style={{ color: '#b4b2a9', fontSize: 10 }}>—</span></td>
                          const cellKey = mKey(r.co, m)
                          const paid = taxDone[cellKey]
                          return (
                            <td key={m} className="center">
                              <div className={`tax-cell ${paid ? 'tax-paid' : 'tax-unpaid'}`} style={{ minWidth: 0, fontSize: 9.5 }} onClick={() => onToggleMonthTax(cellKey)}>
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
function EditCoReports({ company, onChange, adminSettings }: { company: Company; onChange: (fn: (p: Company | null) => Company | null) => void; adminSettings: AdminSettings }) {
  const [newRepName, setNewRepName] = useState('')
  const [newRepPeriod, setNewRepPeriod] = useState('quarterly')
  const [newRepType, setNewRepType] = useState('tax')

  const skip = company.skipReports || []
  const extra = company.extraReports || []
  const taxList = (adminSettings.taxReports[company.reg] || []).map(r => r.code)
  const statList = (adminSettings.statReports[company.reg] || []).map(r => r.code)

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
                const periodLabel = period === 'quarterly' ? 'кварт.' : period === 'semi-annual' ? 'Q2+Q4' : period === 'monthly' ? 'ежемес.' : 'годовой'
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
              <option value="semi-annual">Полугодовой (Q2+Q4)</option>
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

// ─── КОМПОНЕНТ: АДМИНИСТРИРОВАНИЕ ──────────────
function AdminSection({ adminSettings, onSave }: { adminSettings: AdminSettings; onSave: (s: AdminSettings) => void }) {
  const [sub, setSub] = useState<'refs' | 'tax' | 'stat' | 'users'>('refs')

  // ── Пользователи ──
  type UserRow = { id: string; name: string; email: string; role: string }
  const [userList, setUserList] = useState<UserRow[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [usersLoading, setUsersLoading] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState('user')
  const [userMsg, setUserMsg] = useState('')
  const [userErr, setUserErr] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  async function loadUsers() {
    setUsersLoading(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) { const d = await res.json(); setUserList(d) }
    setUsersLoading(false); setUsersLoaded(true)
  }

  async function createUser() {
    setUserErr(''); setUserMsg('')
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setUserErr('Заполните имя, email и пароль'); return
    }
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newUserName.trim(), email: newUserEmail.trim(), password: newUserPassword, role: newUserRole }),
    })
    const data = await res.json()
    if (!res.ok) { setUserErr(data.error || 'Ошибка'); return }
    setUserList(p => [...p, data])
    setNewUserName(''); setNewUserEmail(''); setNewUserPassword('')
    setUserMsg(`Пользователь ${data.name} создан`)
  }

  async function deleteUser(u: UserRow) {
    if (!confirm(`Удалить пользователя ${u.name} (${u.email})?`)) return
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    })
    setUserList(p => p.filter(x => x.id !== u.id))
  }
  const [newItems, setNewItems] = useState<Record<string, string>>({})
  const [newRep, setNewRep] = useState<Record<string, { code: string; period: string; hasMonths: boolean; onlyEvenQ: boolean }>>({})

  type RefKey = 'regimes' | 'categories' | 'groups' | 'bases' | 'statuses' | 'risks'
  const refs: { key: RefKey; label: string; icon: string }[] = [
    { key: 'regimes', label: 'Налоговые режимы', icon: '🏛' },
    { key: 'groups', label: 'Группы обслуживания', icon: '📦' },
    { key: 'categories', label: 'Категории', icon: '🏷' },
    { key: 'bases', label: '1С База', icon: '💾' },
    { key: 'statuses', label: 'Статусы компании', icon: '🔘' },
    { key: 'risks', label: 'Уровни риска', icon: '⚠️' },
  ]

  function addItem(key: RefKey) {
    const val = (newItems[key] || '').trim()
    if (!val || adminSettings[key].includes(val)) return
    onSave({ ...adminSettings, [key]: [...adminSettings[key], val] })
    setNewItems(p => ({ ...p, [key]: '' }))
  }
  function deleteItem(key: RefKey, item: string) {
    if (!confirm(`Удалить "${item}"?`)) return
    onSave({ ...adminSettings, [key]: adminSettings[key].filter(x => x !== item) })
  }
  function renameItem(key: RefKey, oldVal: string, newVal: string) {
    if (!newVal.trim() || newVal === oldVal) return
    onSave({ ...adminSettings, [key]: adminSettings[key].map(x => x === oldVal ? newVal.trim() : x) })
  }

  const isStatTab = sub === 'stat'
  const repField = isStatTab ? adminSettings.statReports : adminSettings.taxReports

  function getInp(regime: string) {
    return newRep[regime] || { code: '', period: 'quarterly', hasMonths: false, onlyEvenQ: false }
  }
  function setInp(regime: string, val: Partial<{ code: string; period: string; hasMonths: boolean; onlyEvenQ: boolean }>) {
    setNewRep(p => ({ ...p, [regime]: { ...getInp(regime), ...val } }))
  }
  function addReport(regime: string) {
    const inp = getInp(regime)
    if (!inp.code.trim()) return
    const item: AdminReportItem = { code: inp.code.trim(), period: inp.period as 'quarterly' | 'annual' | 'monthly' | 'semi-annual', hasMonths: inp.hasMonths, onlyEvenQ: inp.onlyEvenQ }
    const existing = repField[regime] || []
    if (existing.some(r => r.code === item.code)) return
    const field = isStatTab ? 'statReports' : 'taxReports'
    onSave({ ...adminSettings, [field]: { ...repField, [regime]: [...existing, item] } })
    setNewRep(p => ({ ...p, [regime]: { code: '', period: 'quarterly', hasMonths: false, onlyEvenQ: false } }))
  }
  function deleteReport(regime: string, code: string) {
    const field = isStatTab ? 'statReports' : 'taxReports'
    onSave({ ...adminSettings, [field]: { ...repField, [regime]: (repField[regime] || []).filter(r => r.code !== code) } })
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const }}>
        <div className="stabs" style={{ marginBottom: 0 }}>
          <button className={`stab${sub === 'refs' ? ' active' : ''}`} onClick={() => setSub('refs')}>📚 Справочники</button>
          <button className={`stab${sub === 'tax' ? ' active' : ''}`} onClick={() => setSub('tax')}>📋 Нал. отчёты</button>
          <button className={`stab${sub === 'stat' ? ' active' : ''}`} onClick={() => setSub('stat')}>📊 Стат. отчёты</button>
          <button className={`stab${sub === 'users' ? ' active' : ''}`} onClick={() => { setSub('users'); if (!usersLoaded) loadUsers() }}>👥 Пользователи</button>
        </div>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>Настройки применяются ко вкладкам Налоги и Отчётность</span>
      </div>

      {sub === 'refs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
          {refs.map(({ key, label, icon }) => (
            <div key={key} style={{ background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 2px 8px rgba(99,102,241,.08)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>{icon} {label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, maxHeight: 220, overflowY: 'auto' }}>
                {adminSettings[key].map(item => (
                  <RefItem key={item} value={item} onDelete={() => deleteItem(key, item)} onRename={nv => renameItem(key, item, nv)} />
                ))}
                {adminSettings[key].length === 0 && <div style={{ fontSize: 11, color: '#d1d5db', padding: '4px 0' }}>Пусто</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" placeholder="Новое значение..." value={newItems[key] || ''}
                  onChange={e => setNewItems(p => ({ ...p, [key]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addItem(key)}
                  style={{ flex: 1, fontSize: 12, padding: '6px 9px', border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none' }}
                />
                <button onClick={() => addItem(key)} className="btn-sm">+ Добавить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(sub === 'tax' || sub === 'stat') && (
        <div>
          <div style={{ fontSize: 11, color: '#4f46e5', marginBottom: 12, padding: '7px 12px', background: '#f5f3ff', borderRadius: 7, border: '1px solid #e0d9fb' }}>
            {isStatTab ? '📊 Статистические отчёты — какие формы сдаёт каждый режим (квартально/годовой)' : '📋 Налоговые декларации — настройте формы по режимам. Месяца = ежемесячный налог, Q2+Q4 = только 2-й и 4-й квартал'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
            {adminSettings.regimes.map(regime => {
              const reps = repField[regime] || []
              const inp = getInp(regime)
              return (
                <div key={regime} style={{ background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 2px 8px rgba(99,102,241,.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>{regime}</span>
                    <span style={{ fontSize: 10, background: '#f3f4f6', color: '#6b7280', borderRadius: 99, padding: '2px 7px', marginLeft: 'auto' }}>{reps.length} отчётов</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10, minHeight: 28 }}>
                    {reps.length === 0 && <div style={{ fontSize: 11, color: '#d1d5db' }}>Отчётов не настроено</div>}
                    {reps.map(rep => (
                      <div key={rep.code} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#f9fafb', borderRadius: 7, fontSize: 11 }}>
                        <span style={{ flex: 1, color: '#111827', fontWeight: 500 }}>{rep.code}</span>
                        <span style={{ color: '#94a3b8', fontSize: 10, whiteSpace: 'nowrap' as const }}>{rep.period === 'annual' ? 'год.' : rep.period === 'monthly' ? 'ежемес.' : (rep.period === 'semi-annual' || rep.onlyEvenQ) ? 'Q2+Q4' : 'кварт.'}</span>
                        {rep.hasMonths && <span style={{ fontSize: 9, background: '#ede9fe', color: '#6d28d9', borderRadius: 4, padding: '1px 5px' }}>мес.</span>}
                        <button onClick={() => deleteReport(regime, rep.code)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                    <input type="text" placeholder="Код отчёта, напр. 300.00 (НДС)..." value={inp.code}
                      onChange={e => setInp(regime, { code: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && addReport(regime)}
                      style={{ width: '100%', fontSize: 11, padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 6, outline: 'none', boxSizing: 'border-box' as const }}
                    />
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                      <select value={inp.period} onChange={e => setInp(regime, { period: e.target.value })} style={{ fontSize: 11, padding: '4px 7px', border: '1px solid #e5e7eb', borderRadius: 5 }}>
                        <option value="quarterly">Квартально</option>
                        <option value="semi-annual">Полугодовой (Q2+Q4)</option>
                        <option value="monthly">Ежемесячно</option>
                        <option value="annual">Годовой</option>
                      </select>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: '#6b7280', cursor: 'pointer' }}>
                        <input type="checkbox" checked={inp.hasMonths} onChange={e => setInp(regime, { hasMonths: e.target.checked })} style={{ accentColor: '#6366f1' }} />
                        Месяца
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: '#6b7280', cursor: 'pointer' }}>
                        <input type="checkbox" checked={inp.onlyEvenQ} onChange={e => setInp(regime, { onlyEvenQ: e.target.checked })} style={{ accentColor: '#6366f1' }} />
                        Q2+Q4
                      </label>
                      <button onClick={() => addReport(regime)} className="btn-sm" style={{ marginLeft: 'auto' }}>+ Добавить</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Пользователи ── */}
      {sub === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

          {/* Форма создания */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(99,102,241,.08)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>
              ➕ Новый пользователь
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Имя</div>
                <input value={newUserName} onChange={e => setNewUserName(e.target.value)}
                  placeholder="Нурдаулет"
                  style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1.5px solid #e5e7eb', borderRadius: 7, outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Email</div>
                <input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)}
                  placeholder="user@buhdesk.kz" type="email"
                  style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1.5px solid #e5e7eb', borderRadius: 7, outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Пароль</div>
                <div style={{ position: 'relative' as const }}>
                  <input value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)}
                    type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                    style={{ width: '100%', fontSize: 13, padding: '7px 36px 7px 10px', border: '1.5px solid #e5e7eb', borderRadius: 7, outline: 'none', boxSizing: 'border-box' as const }} />
                  <button onClick={() => setShowPwd(p => !p)}
                    style={{ position: 'absolute' as const, right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af' }}>
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Роль</div>
                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}
                  style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1.5px solid #e5e7eb', borderRadius: 7, outline: 'none', boxSizing: 'border-box' as const, background: '#fff' }}>
                  <option value="user">Сотрудник</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              {userErr && <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 12, padding: '7px 10px', borderRadius: 7 }}>{userErr}</div>}
              {userMsg && <div style={{ background: '#dcfce7', color: '#166534', fontSize: 12, padding: '7px 10px', borderRadius: 7 }}>{userMsg}</div>}
              <button onClick={createUser}
                style={{ padding: '9px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                Создать пользователя
              </button>
            </div>
          </div>

          {/* Список пользователей */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(99,102,241,.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>👥 Список пользователей</div>
              <button onClick={loadUsers} style={{ fontSize: 11, padding: '4px 10px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>
                {usersLoading ? '...' : '🔄 Обновить'}
              </button>
            </div>
            {usersLoading && <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' as const, padding: '20px 0' }}>Загрузка...</div>}
            {!usersLoading && userList.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' as const, padding: '20px 0' }}>Нет пользователей</div>}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {userList.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f3f4f6' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#6366f1', flexShrink: 0 }}>
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{u.email}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: u.role === 'admin' ? '#e0e7ff' : '#f3f4f6', color: u.role === 'admin' ? '#6366f1' : '#6b7280', fontWeight: 600, flexShrink: 0 }}>
                    {u.role === 'admin' ? 'Админ' : 'Сотрудник'}
                  </span>
                  <button onClick={() => deleteUser(u)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: 16, flexShrink: 0, lineHeight: 1 }} title="Удалить">✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── УПЛАТА НАЛОГОВ ─────────────────────────────────────────────────────────
function fmtAmt(v: string): string {
  const raw = (v || '').replace(/\s/g, '').replace(/[^\d.]/g, '')
  if (!raw) return ''
  const [int, dec] = raw.split('.')
  const fmtInt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return dec !== undefined ? fmtInt + '.' + dec : fmtInt
}

function getPayPeriods(type: 'kpn' | 'nds', year: number) {
  if (type === 'kpn') {
    return [
      { q: '1 квартал', label: `1 квартал (янв–март ${year})`, due: `${year}-05-25`, dueLabel: `25 мая ${year}` },
      { q: '2 квартал', label: `2 квартал (апр–июнь ${year})`, due: `${year}-08-25`, dueLabel: `25 августа ${year}` },
      { q: '3 квартал', label: `3 квартал (июль–сент ${year})`, due: `${year}-11-25`, dueLabel: `25 ноября ${year}` },
      { q: '4 квартал', label: `4 квартал (окт–дек ${year})`, due: `${year + 1}-02-25`, dueLabel: `25 февраля ${year + 1}` },
    ]
  }
  return [
    { q: '1 квартал', label: `1 квартал (янв–март ${year})`, due: `${year}-04-25`, dueLabel: `25 апреля ${year}` },
    { q: '2 квартал', label: `2 квартал (апр–июнь ${year})`, due: `${year}-07-25`, dueLabel: `25 июля ${year}` },
    { q: '3 квартал', label: `3 квартал (июль–сент ${year})`, due: `${year}-10-25`, dueLabel: `25 октября ${year}` },
    { q: '4 квартал', label: `4 квартал (окт–дек ${year})`, due: `${year + 1}-01-25`, dueLabel: `25 января ${year + 1}` },
  ]
}

function PaySection({ companies, payEntries, payYear, paySubTab, paySearch, onYearChange, onSubTabChange, onSearchChange, onSave }: {
  companies: Company[]
  payEntries: Record<string, PayEntry>
  payYear: number
  paySubTab: 'kpn' | 'nds'
  paySearch: string
  onYearChange: (y: number) => void
  onSubTabChange: (t: 'kpn' | 'nds') => void
  onSearchChange: (s: string) => void
  onSave: (key: string, patch: Partial<PayEntry>) => void
}) {
  const [selQ, setSelQ] = useState('2 квартал')
  const [paidFilter, setPaidFilter] = useState<'' | 'paid' | 'unpaid'>('')
  const active = companies.filter(c => c.status === 'Активная')
  const base = paySubTab === 'nds' ? active.filter(c => c.nds || c.reg === 'ОУР (НДС)' || c.reg.includes('НДС')) : active
  const list = paySearch ? base.filter(c => c.n.toLowerCase().includes(paySearch.toLowerCase())) : base
  const periods = getPayPeriods(paySubTab, payYear)
  const p = periods.find(x => x.q === selQ) || periods[0]

  const fmt = (n: number) => n > 0 ? n.toLocaleString('ru-RU') : '—'

  // Статистика по выбранному кварталу
  let totalSum = 0, paidSum = 0, paidCount = 0, unpaidCount = 0
  list.forEach(c => {
    const key = `${c.n}|${paySubTab}|${p.q}|${payYear}`
    const e = payEntries[key]
    const amt = e ? parseFloat(e.amount.replace(/\s/g, '').replace(',', '.')) || 0 : 0
    totalSum += amt
    if (e?.paid) { paidSum += amt; paidCount++ } else { unpaidCount++ }
  })
  const unpaidSum = totalSum - paidSum
  const displayList = paidFilter === 'paid'
    ? list.filter(c => payEntries[`${c.n}|${paySubTab}|${p.q}|${payYear}`]?.paid)
    : paidFilter === 'unpaid'
    ? list.filter(c => !payEntries[`${c.n}|${paySubTab}|${p.q}|${payYear}`]?.paid)
    : list

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dueDate = new Date(p.due); dueDate.setHours(0, 0, 0, 0)
  const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / 86400000)
  const isOverdue = daysLeft < 0
  const isSoon = daysLeft >= 0 && daysLeft <= 7

  return (
    <div>
      {/* ── Фильтры ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' as const }}>
        <div className="stabs" style={{ marginBottom: 0 }}>
          <button className={`stab${paySubTab === 'kpn' ? ' active' : ''}`} onClick={() => onSubTabChange('kpn')}>КПН и ИПН</button>
          <button className={`stab${paySubTab === 'nds' ? ' active' : ''}`} onClick={() => onSubTabChange('nds')}>НДС</button>
        </div>
        <input
          type="text"
          placeholder="Поиск компании..."
          value={paySearch}
          onChange={e => onSearchChange(e.target.value)}
          style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', minWidth: 200, outline: 'none' }}
        />
        <select value={payYear} onChange={e => onYearChange(+e.target.value)} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#111827' }}>
          <option value={2025}>2025 год</option>
          <option value={2026}>2026 год</option>
          <option value={2027}>2027 год</option>
        </select>
        <select value={selQ} onChange={e => setSelQ(e.target.value)} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#111827' }}>
          {periods.map(x => <option key={x.q} value={x.q}>{x.q} · до {x.dueLabel}</option>)}
        </select>
      </div>

      {/* ── Мини-аналитика ── */}
      <div className="srow" style={{ marginBottom: 16 }}>
        <div className="stat s-indigo" style={{ cursor: 'pointer' }} onClick={() => setPaidFilter('')}>
          <div className="sl">Компаний</div>
          <div className="sv">{list.length}</div>
        </div>
        <div className="stat s-green" style={{ cursor: 'pointer', ...(paidFilter === 'paid' ? { outline: '2px solid #16a34a', outlineOffset: -2 } : {}) }} onClick={() => setPaidFilter(f => f === 'paid' ? '' : 'paid')}>
          <div className="sl">Уплачено {paidFilter === 'paid' ? '▼' : ''}</div>
          <div className="sv green">{paidCount}</div>
        </div>
        <div className="stat s-red" style={{ cursor: 'pointer', ...(paidFilter === 'unpaid' ? { outline: '2px solid #dc2626', outlineOffset: -2 } : {}) }} onClick={() => setPaidFilter(f => f === 'unpaid' ? '' : 'unpaid')}>
          <div className="sl">Не уплачено {paidFilter === 'unpaid' ? '▼' : ''}</div>
          <div className="sv red">{unpaidCount}</div>
        </div>
        <div className="stat" style={{ borderLeft: '3px solid #6366f1' }}>
          <div className="sl">Сумма всего</div>
          <div className="sv" style={{ fontSize: 15 }}>{fmt(totalSum)} ₸</div>
        </div>
        <div className="stat" style={{ borderLeft: '3px solid #16a34a' }}>
          <div className="sl">Уплачено ₸</div>
          <div className="sv green" style={{ fontSize: 15 }}>{fmt(paidSum)} ₸</div>
        </div>
        <div className="stat" style={{ borderLeft: '3px solid #dc2626' }}>
          <div className="sl">Остаток ₸</div>
          <div className="sv red" style={{ fontSize: 15 }}>{fmt(unpaidSum)} ₸</div>
        </div>
      </div>

      {/* ── Карточка квартала ── */}
      <div style={{ background: '#fff', border: `1.5px solid ${isOverdue ? '#fecaca' : isSoon ? '#fde68a' : '#e5e7eb'}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', background: isOverdue ? '#fef2f2' : isSoon ? '#fffbeb' : '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{p.q}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{p.label}</div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: isOverdue ? '#dc2626' : isSoon ? '#d97706' : '#374151' }}>
              Срок уплаты: {p.dueLabel}
            </div>
            {isOverdue && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>Просрочено на {Math.abs(daysLeft)} дн.</div>}
            {isSoon && !isOverdue && <div style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>Осталось {daysLeft} дн.</div>}
          </div>
        </div>

        <div style={{ overflowY: 'auto' as const, maxHeight: 'calc(100vh - 360px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
            <thead style={{ position: 'sticky' as const, top: 0, zIndex: 1 }}>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left' as const, fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e5e7eb' }}>Компания</th>
                <th style={{ padding: '8px 10px', textAlign: 'left' as const, fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e5e7eb' }}>Режим</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' as const, fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const }}>Сумма (₸)</th>
                <th style={{ padding: '8px 10px', textAlign: 'left' as const, fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e5e7eb' }}>Комментарий</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' as const, fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e5e7eb' }}>Уплачен</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((c, ci) => {
                const key = `${c.n}|${paySubTab}|${p.q}|${payYear}`
                const e = payEntries[key] || { amount: '', comment: '', paid: false }
                const hasAmt = parseFloat((e.amount || '').replace(/\s/g, '').replace(',', '.')) > 0
                const rowBg = e.paid ? '#f0fdf4' : hasAmt ? '#fff5f5' : '#ffffff'
                return (
                  <tr key={ci} style={{ borderBottom: '1px solid #f3f4f6', background: rowBg }}>
                    <td style={{ padding: '6px 16px', color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontWeight: 500 }} title={c.n}>
                      {c.n}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#9ca3af', fontSize: 11, whiteSpace: 'nowrap' as const }}>{c.reg}</td>
                    <td style={{ padding: '4px 10px' }}>
                      <input
                        type="text"
                        value={fmtAmt(e.amount)}
                        onChange={ev => onSave(key, { amount: fmtAmt(ev.target.value) })}
                        placeholder="0"
                        style={{ width: 130, fontSize: 13, fontWeight: 600, padding: '6px 10px', border: '1.5px solid #d1d5db', borderRadius: 6, textAlign: 'right' as const, outline: 'none', background: '#fff', color: '#111827' }}
                      />
                    </td>
                    <td style={{ padding: '4px 10px' }}>
                      <input
                        type="text"
                        value={e.comment}
                        onChange={ev => onSave(key, { comment: ev.target.value })}
                        placeholder="Заметка..."
                        style={{ width: '100%', minWidth: 160, fontSize: 12, padding: '6px 10px', border: '1.5px solid #d1d5db', borderRadius: 6, outline: 'none', background: '#fff', color: '#111827' }}
                      />
                    </td>
                    <td style={{ padding: '4px 10px', textAlign: 'center' as const }}>
                      <input
                        type="checkbox"
                        checked={e.paid}
                        onChange={ev => onSave(key, { paid: ev.target.checked })}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#16a34a' }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function RefItem({ value, onDelete, onRename }: { value: string; onDelete: () => void; onRename: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onRename(draft); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
          style={{ flex: 1, fontSize: 12, padding: '4px 7px', border: '1.5px solid #6366f1', borderRadius: 5, outline: 'none' }}
        />
        <button onClick={() => { onRename(draft); setEditing(false) }} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>✓</button>
        <button onClick={() => { setDraft(value); setEditing(false) }} style={{ background: '#f3f4f6', border: 'none', borderRadius: 5, fontSize: 11, padding: '3px 6px', cursor: 'pointer' }}>✕</button>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', background: '#f9fafb', borderRadius: 7, fontSize: 12, gap: 6 }}>
      <span style={{ flex: 1, color: '#374151' }}>{value}</span>
      <button onClick={() => { setDraft(value); setEditing(true) }} style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', fontSize: 12, padding: '0 2px' }} title="Переименовать">✏️</button>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>✕</button>
    </div>
  )
}
