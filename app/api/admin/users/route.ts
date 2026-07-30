import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('User')
    .select('id, name, email, role')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, email, password, role } = body

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Имя, email и пароль обязательны' }, { status: 400 })
  }

  // Проверяем, нет ли уже такого email
  const { data: existing } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const { data, error } = await supabaseAdmin
    .from('User')
    .insert({ name, email, password: hashedPassword, role: role || 'user' })
    .select('id, name, email, role')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

  const { error } = await supabaseAdmin.from('User').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
