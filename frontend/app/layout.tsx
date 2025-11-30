import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import { WalletProvider } from '../src/components/WalletProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EventGuard | Prediction-Powered NFT Ticketing',
  description: 'On-chain ticketing with anti-scalping rules, Polymarket protection, and Culture Passport badges.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-slate-50 min-h-screen`}>
        <WalletProvider>
          <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-930 to-slate-900">
            {children}
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
