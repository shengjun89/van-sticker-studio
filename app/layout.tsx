import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'MXGARAGE · Wrap Studio',
  description:
    'Describe your idea, generate four campervan decal designs, and preview them in an interactive 3D scene.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
