import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// Real Task table columns:
// id, companyId, companyName(=co), description(=desc), assigneeId, assigneeName(=emp), priority(=prio), deadline(=date), status(=st), createdAt, creatorId, creatorName(=by)

function toDb(t: any) {
  return {
    companyName: t.co || '',
    description: t.desc || t.description || '',
    assigneeName: t.emp || '',
    priority: t.prio || t.priority || 'Обычный',
    deadline: t.date ? t.date + 'T00:00:00' : null,
    status: t.st || t.status || 'В работе',
  }
}

function fromDb(row: any) {
  return {
    id: row.id,
    co: row.companyName || '',
    desc: row.description || '',
    emp: row.assigneeName || '',
    prio: row.priority || 'Обычный',
    date: row.deadline ? String(row.deadline).slice(0, 10) : '',
    st: row.status || 'В работе',
    by: row.creatorName || '',
    byId: row.creatorId || '',
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('Task').select('*').order('createdAt', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(fromDb))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const user = session.user as any
  const { data, error } = await supabase.from('Task')
    .insert([{ id: crypto.randomUUID(), ...toDb(body), creatorId: user.id, creatorName: user.name }])
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(fromDb(data))
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, ...rest } = body
  const { data, error } = await supabase.from('Task').update(toDb(rest)).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(fromDb(data))
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const { id } = await req.json()

  if (user.role !== 'admin') {
    const { data: existing, error: fetchErr } = await supabase.from('Task').select('creatorId, creatorName').eq('id', id).single()
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    const isCreator = existing && (existing.creatorId === user.id || (!existing.creatorId && existing.creatorName === user.name))
    if (!isCreator) return NextResponse.json({ error: 'Удалить может только автор задачи или администратор' }, { status: 403 })
  }

  const { error } = await supabase.from('Task').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
