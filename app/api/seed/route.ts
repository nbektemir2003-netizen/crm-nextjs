import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  const existing = await prisma.user.findUnique({ where: { email: 'admin@crm.kz' } })
  if (existing) return NextResponse.json({ message: 'Already seeded' })

  const hash = await bcrypt.hash('admin123', 10)
  await prisma.user.create({
    data: { email: 'admin@crm.kz', name: 'Администратор', passwordHash: hash, role: 'admin' },
  })

  return NextResponse.json({ message: 'Seeded successfully' })
}
