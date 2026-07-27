import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BUCKET = 'appdata'
const FILE = 'payentries.json'

type PayEntry = { amount: string; comment: string; paid: boolean }

async function readFile(): Promise<Record<string, PayEntry>> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(FILE)
  if (error || !data) return {}
  try {
    const text = await data.text()
    return JSON.parse(text) || {}
  } catch {
    return {}
  }
}

async function writeFile(payload: Record<string, PayEntry>) {
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  await supabaseAdmin.storage.from(BUCKET).update(FILE, blob, {
    contentType: 'application/json',
    upsert: true,
  })
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await readFile()
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const rows: { key: string; amount: string; comment: string; paid: boolean }[] =
    Array.isArray(body) ? body : [body]

  const current = await readFile()
  for (const row of rows) {
    current[row.key] = { amount: row.amount, comment: row.comment, paid: row.paid }
  }
  await writeFile(current)
  return NextResponse.json({ ok: true })
}
