import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results: Record<string, string> = {}

  try {
    const postgres = (await import('postgres')).default
    const sql = postgres(process.env.DATABASE_URL!, {
      ssl: 'require',
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
    })

    await sql`
      CREATE TABLE IF NOT EXISTS "PayEntry" (
        key text PRIMARY KEY,
        amount text NOT NULL DEFAULT '',
        comment text NOT NULL DEFAULT '',
        paid boolean NOT NULL DEFAULT false,
        "updatedAt" timestamptz DEFAULT now()
      )
    `
    results.PayEntry = 'created or already exists'

    await sql`ALTER TABLE "PayEntry" DISABLE ROW LEVEL SECURITY`
    results.PayEntry_rls = 'RLS disabled'

    await sql`ALTER TABLE IF EXISTS "TaxDone" DISABLE ROW LEVEL SECURITY`
    results.TaxDone_rls = 'RLS disabled'

    await sql`ALTER TABLE IF EXISTS "RepDone" DISABLE ROW LEVEL SECURITY`
    results.RepDone_rls = 'RLS disabled'

    await sql.end()
    return NextResponse.json({ ok: true, results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg, results }, { status: 500 })
  }
}
