import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// Real Task table columns:
// id, companyId, companyName(=co), description(=desc), assigneeId, assigneeName(=emp), priority(=prio), deadline(=date), status(=st), createdAt

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
  const { data, error } = await supabase.from('Task').insert([{ id: crypto.randomUUID(), ...toDb(body) }]).select().single()
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
  const { id } = await req.json()
  const { error } = await supabase.from('Task').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
