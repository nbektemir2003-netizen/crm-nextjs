import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from 'next-auth/react'

export const metadata: Metadata = {
  title: 'BuhDesk',
  description: 'Бухгалтерский аутсорсинг — управление компаниями, налогами и отчётами',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      </head>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
