import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('RepDone').select('key,done')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result: Record<string, boolean> = {}
  for (const row of data || []) result[row.key] = row.done
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const rows = Array.isArray(body) ? body : [body]
  const { error } = await supabase.from('RepDone').upsert(rows, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
