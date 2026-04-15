"use client";

import { wirefluid } from "@/config/wagmi";
import { truncateAddress } from "@/utils/format";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";

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
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [mobileOpen, setMobileOpen] = useState(false);

  const prevConnected = useRef(isConnected);

  useEffect(() => {
    if (isConnected && !prevConnected.current && pathname === "/") {
      router.push("/market");
    }
    prevConnected.current = isConnected;
  }, [isConnected, pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isWrongNetwork = isConnected && chain?.id !== wirefluid.id;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="min-w-0 shrink font-display text-lg font-bold text-primary sm:text-xl"
        >
          <span className="truncate">
            PSL<span className="text-foreground">Market</span>
          </span>
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

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 md:flex">
            {isConnected ? (
              isWrongNetwork ? (
                <button
                  onClick={() => switchChain({ chainId: wirefluid.id })}
                  className="rounded-lg border-2 border-red-500 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/20"
                >
                  Switch to WireFluid
                </button>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">
                    {truncateAddress(address || "")}
                  </span>
                  <button
                    onClick={() => disconnect()}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Disconnect
                  </button>
                </>
              )
            ) : (
              <button
                onClick={() =>
                  connect({ connector: injected(), chainId: wirefluid.id })
                }
                className="rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
              >
                Connect Wallet
              </button>
            )}
          </div>

          {isConnected && !isWrongNetwork ? (
            <span className="rounded-full border border-border bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground md:hidden">
              {truncateAddress(address || "")}
            </span>
          ) : null}

          {!isConnected ? (
            <button
              onClick={() =>
                connect({ connector: injected(), chainId: wirefluid.id })
              }
              className="rounded-lg bg-gold-gradient px-3 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 md:hidden"
            >
              Connect
            </button>
          ) : isWrongNetwork ? (
            <button
              onClick={() => switchChain({ chainId: wirefluid.id })}
              className="rounded-lg border border-red-500 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 md:hidden"
            >
              Switch
            </button>
          ) : null}

          <button
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="rounded-lg p-2 text-foreground transition-colors hover:bg-muted md:hidden"
          >
            <svg
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
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
          <div className="container mx-auto space-y-4 px-4 py-4">
            {isConnected ? (
              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Wallet
                </p>
                <p className="mt-1 break-all text-sm font-medium text-foreground">
                  {address}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {isWrongNetwork ? (
                    <button
                      onClick={() => switchChain({ chainId: wirefluid.id })}
                      className="rounded-lg border border-red-500 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500"
                    >
                      Switch to WireFluid
                    </button>
                  ) : (
                    <button
                      onClick={() => disconnect()}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground"
                    >
                      Disconnect Wallet
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() =>
                  connect({ connector: injected(), chainId: wirefluid.id })
                }
                className="w-full rounded-xl bg-gold-gradient px-4 py-3 text-sm font-semibold text-primary-foreground"
              >
                Connect Wallet
              </button>
            )}

            <div className="grid gap-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    pathname === item.path
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/40 text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
