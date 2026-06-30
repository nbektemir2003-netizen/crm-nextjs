import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from 'next-auth/react'

export const metadata: Metadata = {
  title: 'CRM Аутсорс 2026',
  description: 'CRM для бухгалтерской компании',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-[#f5f5f0] text-[#1a1a18]">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
