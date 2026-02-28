import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WORKER Platform',
  description: 'Production-ready NEXT.js interface for WORKER',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
