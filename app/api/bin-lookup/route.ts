import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const bin = searchParams.get('bin')?.trim()
  if (!bin || bin.length < 12) return NextResponse.json({ error: 'Введите 12-значный БИН/ИИН' }, { status: 400 })

  // Попытка 1: открытый API КГД (проверка налогоплательщика)
  try {
    const kgdRes = await fetch(
      `https://kgd.gov.kz/mobile_api/taxpayers/${bin}`,
      { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
    )
    if (kgdRes.ok) {
      const data = await kgdRes.json()
      const name = data?.taxpayerName || data?.name || data?.fullName || data?.organization
      if (name) return NextResponse.json({ name: String(name).trim(), bin, source: 'kgd' })
    }
  } catch {}

  // Попытка 2: egov открытые данные (реестр юрлиц)
  try {
    const egovRes = await fetch(
      `https://data.egov.kz/api/v4/Gbd_Yridos?apiKey=test&$filter=BIN eq '${bin}'&$top=1`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
    )
    if (egovRes.ok) {
      const data = await egovRes.json()
      const item = Array.isArray(data) ? data[0] : data?.value?.[0]
      const name = item?.NameRu || item?.NAME_RU || item?.fullName
      if (name) return NextResponse.json({ name: String(name).trim(), bin, source: 'egov' })
    }
  } catch {}

  // Попытка 3: stat.gov.kz
  try {
    const statRes = await fetch(
      `https://stat.gov.kz/api/subject/legal_entity/summary/${bin}`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
    )
    if (statRes.ok) {
      const data = await statRes.json()
      const name = data?.nameRu || data?.name || data?.organizationNameRu
      if (name) return NextResponse.json({ name: String(name).trim(), bin, source: 'stat' })
    }
  } catch {}

  return NextResponse.json({ error: 'Компания не найдена. Введите название вручную.', bin }, { status: 404 })
}
