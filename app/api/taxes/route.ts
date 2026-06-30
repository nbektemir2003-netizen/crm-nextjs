import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const taxes = await prisma.taxPayment.findMany({
    include: { company: true },
    orderBy: { dueDate: 'asc' },
  })
  return NextResponse.json(taxes)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const tax = await prisma.taxPayment.create({ data: body })
  return NextResponse.json(tax)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, ...data } = body
  const tax = await prisma.taxPayment.update({ where: { id }, data })
  return NextResponse.json(tax)
}
