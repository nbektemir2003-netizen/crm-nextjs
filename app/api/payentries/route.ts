import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function ensureTable() {
  try {
    const postgres = (await import('postgres')).default
    const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1, idle_timeout: 10 })
    await sql`
      CREATE TABLE IF NOT EXISTS "PayEntry" (
        key text PRIMARY KEY,
        amount text NOT NULL DEFAULT '',
        comment text NOT NULL DEFAULT '',
        paid boolean NOT NULL DEFAULT false,
        "updatedAt" timestamptz DEFAULT now()
      )
    `
    await sql.end()
  } catch (e) {
    console.error('ensureTable error:', e)
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Try to read; if table missing, create it and retry
  let { data, error } = await supabaseAdmin.from('PayEntry').select('key,amount,comment,paid')
  if (error && error.message.includes('does not exist')) {
    await ensureTable()
    const res2 = await supabaseAdmin.from('PayEntry').select('key,amount,comment,paid')
    data = res2.data; error = res2.error
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result: Record<string, { amount: string; comment: string; paid: boolean }> = {}
  for (const row of data || []) result[row.key] = { amount: row.amount, comment: row.comment, paid: row.paid }
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const rows = Array.isArray(body) ? body : [body]

  let { error } = await supabaseAdmin.from('PayEntry').upsert(rows, { onConflict: 'key' })
  if (error && error.message.includes('does not exist')) {
    await ensureTable()
    const res2 = await supabaseAdmin.from('PayEntry').upsert(rows, { onConflict: 'key' })
    error = res2.error
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
