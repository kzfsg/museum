import type { Metadata, Viewport } from 'next'
// Self-hosted (Fontsource packages of the Google Fonts) so builds don't depend
// on downloading them from Google, which sometimes fails a deploy.
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const brygada = localFont({
  src: [
    { path: '../node_modules/@fontsource-variable/brygada-1918/files/brygada-1918-latin-wght-normal.woff2', weight: '400 700', style: 'normal' },
  ],
  variable: '--font-brygada',
  display: 'swap',
})

const hanken = localFont({
  src: [
    { path: '../node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2', weight: '100 900', style: 'normal' },
  ],
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
