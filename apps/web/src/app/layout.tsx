import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'NetMon — Network Monitoring',
    description: 'BIT Enterprise Network Monitoring',
    icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="light" suppressHydrationWarning>
            <body className={`${inter.variable} font-sans`}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
