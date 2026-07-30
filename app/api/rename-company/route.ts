import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BUCKET = 'appdata'

async function renameInJson(file: string, oldName: string, newName: string) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(file)
  if (error || !data) return
  let obj: Record<string, unknown>
  try { obj = JSON.parse(await data.text()) } catch { return }

  const prefix = oldName + '|'
  const newPrefix = newName + '|'
  let changed = false
  const next: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith(prefix)) {
      next[newPrefix + k.slice(prefix.length)] = v
      changed = true
    } else {
      next[k] = v
    }
  }
  if (!changed) return

  const blob = new Blob([JSON.stringify(next)], { type: 'application/json' })
  const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).update(file, blob, { contentType: 'application/json', upsert: true })
  if (upErr) await supabaseAdmin.storage.from(BUCKET).upload(file, blob, { contentType: 'application/json', upsert: true })
}

async function renameInTable(table: string, oldName: string, newName: string) {
  const prefix = oldName + '|'
  // Fetch all rows with old prefix
  const { data } = await supabaseAdmin.from(table).select('key,done').like('key', `${prefix}%`)
  if (!data || data.length === 0) return
  // Upsert with new keys
  const newRows = data.map((r: { key: string; done: boolean }) => ({
    key: newName + '|' + r.key.slice(prefix.length),
    done: r.done,
  }))
  await supabaseAdmin.from(table).upsert(newRows, { onConflict: 'key' })
  // Delete old rows
  for (const r of data) {
    await supabaseAdmin.from(table).delete().eq('key', r.key)
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { oldName, newName } = await req.json()
  if (!oldName || !newName || oldName === newName) return NextResponse.json({ ok: true })

  await Promise.all([
    renameInTable('TaxDone', oldName, newName),
    renameInTable('RepDone', oldName, newName),
    renameInJson('payentries.json', oldName, newName),
    renameInJson('repextra.json', oldName, newName),
    renameInJson('taxcomments.json', oldName, newName),
  ])

  return NextResponse.json({ ok: true })
}
