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
    description: 'Network Monitoring by PT Bintang Inovasi Teknologi',
    icons: { icon: '/images/bit-favicon.png' },
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
