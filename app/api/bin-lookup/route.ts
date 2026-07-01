import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const bin = searchParams.get('bin')?.trim()
  if (!bin || bin.length < 12) return NextResponse.json({ error: 'Введите 12-значный БИН/ИИН' }, { status: 400 })

  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'ru-RU,ru;q=0.9',
  }
  const timeout = AbortSignal.timeout(6000)

  // Попытка 1: adata.kz — популярный агрегатор казахстанских компаний
  try {
    const r = await fetch(`https://adata.kz/egov/company?bin=${bin}`, { headers, signal: AbortSignal.timeout(6000) })
    if (r.ok) {
      const d = await r.json()
      const name = d?.name || d?.nameRu || d?.company?.name || d?.company?.nameRu
      if (name) return NextResponse.json({ name: String(name).trim(), bin, source: 'adata' })
    }
  } catch {}

  // Попытка 2: KGD открытый поиск налогоплательщика
  try {
    const r = await fetch(`https://kgd.gov.kz/mobile_api/taxpayers/search?bin=${bin}`, { headers, signal: AbortSignal.timeout(6000) })
    if (r.ok) {
      const d = await r.json()
      const name = d?.name || d?.taxpayerName || d?.fullName || d?.[0]?.name
      if (name) return NextResponse.json({ name: String(name).trim(), bin, source: 'kgd' })
    }
  } catch {}

  // Попытка 3: Реестр юридических лиц Казахстана (egov open data)
  try {
    const r = await fetch(
      `https://data.egov.kz/api/v4/Gbd_Yridos?apiKey=demo&$filter=BIN eq '${bin}'&$top=1&$select=NAME_RU,BIN`,
      { headers, signal: AbortSignal.timeout(6000) }
    )
    if (r.ok) {
      const d = await r.json()
      const item = Array.isArray(d) ? d[0] : d?.value?.[0]
      const name = item?.NAME_RU || item?.NameRu
      if (name) return NextResponse.json({ name: String(name).trim(), bin, source: 'egov' })
    }
  } catch {}

  // Попытка 4: uchet.kz (реестр предприятий)
  try {
    const r = await fetch(`https://pk.uchet.kz/api/subject/legal_entity/summary/${bin}`, { headers, signal: AbortSignal.timeout(6000) })
    if (r.ok) {
      const d = await r.json()
      const name = d?.nameRu || d?.name || d?.organizationNameRu
      if (name) return NextResponse.json({ name: String(name).trim(), bin, source: 'uchet' })
    }
  } catch {}

  // Попытка 5: stat.gov.kz
  try {
    const r = await fetch(`https://stat.gov.kz/api/subject/legal_entity/summary/${bin}`, { headers, signal: AbortSignal.timeout(6000) })
    if (r.ok) {
      const d = await r.json()
      const name = d?.nameRu || d?.name
      if (name) return NextResponse.json({ name: String(name).trim(), bin, source: 'stat' })
    }
  } catch {}

  return NextResponse.json({
    error: 'Данные по БИН/ИИН не найдены. Введите название вручную.',
    bin,
    hint: 'Попробуйте найти компанию на adata.kz или kgd.gov.kz'
  }, { status: 404 })
}
