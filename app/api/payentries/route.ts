import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import postgres from 'postgres'

let tableReady = false

async function ensureTable() {
  if (tableReady) return
  const sql = postgres(process.env.DATABASE_URL!)
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
  tableReady = true
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureTable()
  const { data, error } = await supabaseAdmin.from('PayEntry').select('key,amount,comment,paid')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result: Record<string, { amount: string; comment: string; paid: boolean }> = {}
  for (const row of data || []) result[row.key] = { amount: row.amount, comment: row.comment, paid: row.paid }
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureTable()
  const body = await req.json()
  const rows = Array.isArray(body) ? body : [body]
  const { error } = await supabaseAdmin.from('PayEntry').upsert(rows, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
