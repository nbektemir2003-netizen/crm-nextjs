import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'crm-outsource-2026-kz-secret-key-xbx',
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const sb = createClient('https://rqrbjiyqazarlomycdzc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxcmJqaXlxYXphcmxvbXljZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3ODIzMDAsImV4cCI6MjA5ODM1ODMwMH0.dne7GGb29XICld8a5A9T0OyWsns-ChdII8GFJ2q4k08')
        const { data } = await sb.from('User').select('*').eq('email', credentials.email as string).single()
        if (!data) return null
        // Проверяем пароль через колонку passwordHash
        const pwd = credentials.password as string
        let ok = false
        if (data.passwordHash) {
          ok = await bcrypt.compare(pwd, data.passwordHash as string)
        } else {
          // Если хеша нет — разрешаем вход (старые аккаунты без пароля)
          ok = true
        }
        if (!ok) return null
        return { id: data.id, name: data.name, email: data.email, role: data.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
})
