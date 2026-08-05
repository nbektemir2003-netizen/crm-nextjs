import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BUCKET = 'appdata'

async function migrateJson(file: string, nameToId: Record<string, string>) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(file)
  if (error || !data) return 0
  let obj: Record<string, unknown>
  try { obj = JSON.parse(await data.text()) } catch { return 0 }

  let changed = 0
  const next: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const sep = k.indexOf('|')
    if (sep === -1) { next[k] = v; continue }
    const prefix = k.slice(0, sep)
    const rest = k.slice(sep)
    const id = nameToId[prefix]
    if (id) {
      next[id + rest] = v
      changed++
    } else {
      next[k] = v
    }
  }
  if (!changed) return 0

  const blob = new Blob([JSON.stringify(next)], { type: 'application/json' })
  const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).update(file, blob, { contentType: 'application/json', upsert: true })
  if (upErr) await supabaseAdmin.storage.from(BUCKET).upload(file, blob, { contentType: 'application/json', upsert: true })
  return changed
}

async function migrateTable(table: string, nameToId: Record<string, string>) {
  const { data } = await supabaseAdmin.from(table).select('key,done')
  if (!data || data.length === 0) return 0

  let changed = 0
  const toUpsert: { key: string; done: boolean }[] = []
  const toDelete: string[] = []

  for (const row of data as { key: string; done: boolean }[]) {
    const sep = row.key.indexOf('|')
    if (sep === -1) continue
    const prefix = row.key.slice(0, sep)
    const id = nameToId[prefix]
    if (id) {
      const newKey = id + row.key.slice(sep)
      toUpsert.push({ key: newKey, done: row.done })
      toDelete.push(row.key)
      changed++
    }
  }

  if (!changed) return 0

  await supabaseAdmin.from(table).upsert(toUpsert, { onConflict: 'key' })
  for (const k of toDelete) {
    await supabaseAdmin.from(table).delete().eq('key', k)
  }
  return changed
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: companies, error } = await supabaseAdmin.from('Company').select('id, name')
  if (error || !companies) return NextResponse.json({ error: 'Не удалось загрузить компании' }, { status: 500 })

  const nameToId: Record<string, string> = {}
  for (const c of companies as { id: string; name: string }[]) {
    if (c.id && c.name) nameToId[c.name] = c.id
  }

  const results = await Promise.all([
    migrateTable('TaxDone', nameToId),
    migrateTable('RepDone', nameToId),
    migrateJson('payentries.json', nameToId),
    migrateJson('repextra.json', nameToId),
    migrateJson('taxcomments.json', nameToId),
  ])

  const total = results.reduce((a, b) => a + b, 0)
  return NextResponse.json({ ok: true, migrated: total, companies: companies.length })
}
