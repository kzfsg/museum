import type { Metadata, Viewport } from 'next'
import { Brygada_1918, Hanken_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const brygada = Brygada_1918({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-brygada',
  display: 'swap',
})

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-hanken',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Time Machine — travel back in time',
  description:
    'Point your phone around any NYC block and look into its past, with local history and heritage pinned where it happened.',
}

export const viewport: Viewport = {
  themeColor: '#fafaf7',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${brygada.variable} ${hanken.variable} bg-background`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"
        />
      </head>
      <body className="font-sans antialiased min-h-screen">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
