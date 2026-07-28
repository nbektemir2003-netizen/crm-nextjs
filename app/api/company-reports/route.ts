import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BUCKET = 'appdata'
const FILE = 'company-reports.json'

type CoReports = { skipReports: string[]; extraReports: string[]; bin?: string; noReports?: boolean; hasEmployees?: boolean }

async function readFile(): Promise<Record<string, CoReports>> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(FILE)
  if (error || !data) return {}
  try { const text = await data.text(); return JSON.parse(text) || {} } catch { return {} }
}

async function writeFile(payload: Record<string, CoReports>) {
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const { error } = await supabaseAdmin.storage.from(BUCKET).update(FILE, blob, {
    contentType: 'application/json', upsert: true,
  })
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).upload(FILE, blob, {
      contentType: 'application/json', upsert: true,
    })
  }
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
  const current = await readFile()
  current[body.id] = { skipReports: body.skipReports || [], extraReports: body.extraReports || [], bin: body.bin || '', noReports: !!body.noReports, hasEmployees: body.hasEmployees }
  await writeFile(current)
  return NextResponse.json({ ok: true })
}
