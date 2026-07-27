import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BUCKET = 'appdata'
const FILE = 'repextra.json'

type RepExtra = { comment: string; cabinet: boolean }

async function readFile(): Promise<Record<string, RepExtra>> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(FILE)
  if (error || !data) return {}
  try { const text = await data.text(); return JSON.parse(text) || {} } catch { return {} }
}

async function writeFile(payload: Record<string, RepExtra>) {
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  await supabaseAdmin.storage.from(BUCKET).upload(FILE, blob, {
    contentType: 'application/json', upsert: true,
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
  const rows: { key: string; comment: string; cabinet: boolean }[] =
    Array.isArray(body) ? body : [body]
  const current = await readFile()
  for (const row of rows) {
    current[row.key] = { comment: row.comment, cabinet: row.cabinet }
  }
  await writeFile(current)
  return NextResponse.json({ ok: true })
}
