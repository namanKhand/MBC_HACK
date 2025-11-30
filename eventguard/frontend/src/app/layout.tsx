import "./globals.css";
import { SolanaWalletProvider } from "../components/WalletProvider";
import { ReactNode } from "react";

export const metadata = {
  title: "EventGuard",
  description: "Prediction-powered NFT ticketing on Solana",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SolanaWalletProvider>
          <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
            <header className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">EventGuard</h1>
                <p className="text-sm text-slate-400">Prediction-powered NFT ticketing</p>
              </div>
              <div className="text-xs text-slate-400">Devnet</div>
            </header>
            {children}
          </main>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
