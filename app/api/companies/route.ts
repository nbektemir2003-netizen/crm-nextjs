import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// Real Company table columns:
// id, name, taxMode(=reg), serviceGroup(=freq), category(=cat), has1c(bool=b БАР/ЖОҚ), risk, hasVat(bool=nds), status, createdAt
// No skipReports/extraReports columns — store in a separate structure or skip

function toDb(c: any) {
  return {
    name: c.n || c.name || '',
    taxMode: c.reg || '',
    serviceGroup: c.freq || '',
    category: c.cat || '',
    has1c: c.b === 'БАР' || c.has1c === true,
    risk: c.risk || 'низкая',
    hasVat: c.nds === true || c.hasVat === true,
    status: c.status || 'Активная',
  }
}

function fromDb(row: any) {
  return {
    id: row.id,
    n: row.name,
    freq: row.serviceGroup || '',
    reg: row.taxMode || '',
    cat: row.category || '',
    b: row.has1c ? 'БАР' : 'ЖОҚ',
    risk: row.risk || 'низкая',
    nds: !!row.hasVat,
    status: row.status || 'Активная',
    skipReports: [],
    extraReports: [],
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('Company').select('*').order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(fromDb))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { data, error } = await supabase.from('Company').insert([{ id: crypto.randomUUID(), ...toDb(body) }]).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(fromDb(data))
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, ...rest } = body
  const { data, error } = await supabase.from('Company').update(toDb(rest)).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(fromDb(data))
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const { error } = await supabase.from('Company').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
