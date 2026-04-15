'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { truncateAddress } from "@/utils/format";
import { wirefluid } from "@/config/wagmi";
import { useSwitchChain } from 'wagmi';

const NAV_ITEMS = [
  { path: "/", label: "Home" },
  { path: "/market", label: "Market" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/leaderboard", label: "Leaderboard" },
  { path: "/matches", label: "Matches" },
  { path: "/trophies", label: "Trophies" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { address, isConnected, chain } = useAccount();
  const { connect } = useConnect({
    mutation: {
      onSuccess: () => {
        router.push('/market');
      }
    }
  });
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Check if user is on wrong network
  const isWrongNetwork = isConnected && chain?.id !== wirefluid.id;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="font-display text-xl font-bold text-primary">
          🏏 PSL<span className="text-foreground">Market</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === item.path
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <div className="flex items-center gap-2">
              {isWrongNetwork ? (
                <button
                  onClick={() => switchChain({ chainId: wirefluid.id })}
                  className="rounded-lg border-2 border-red-500 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/20"
                >
                  Switch to WireFluid
                </button>
              ) : (
                <>
                  <span className="hidden text-sm text-muted-foreground sm:block">
                    {truncateAddress(address || '')}
                  </span>
                  <button
                    onClick={() => disconnect()}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => connect({ connector: injected(), chainId: wirefluid.id })}
              className="bg-gold-gradient rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
            >
              Connect Wallet
            </button>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-foreground p-1"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border md:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setMobileOpen(false)}
              className={`block px-4 py-3 text-sm ${
                pathname === item.path ? "bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
