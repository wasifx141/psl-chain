'use client';

import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useAccount } from 'wagmi';

export default function TrophyRoom() {
  const { achievements } = useStore();
  const { isConnected: walletConnected } = useAccount();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!walletConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">Connect Your Wallet</h2>
        <p className="text-muted-foreground">Connect to view your trophy room and achievements.</p>
      </div>
    );
  }

  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center animate-in fade-in slide-in-from-top duration-700">
        <h1 className="font-display text-3xl font-bold text-foreground">Trophy Room</h1>
        <p className="mt-2 text-muted-foreground">Soulbound NFT Achievements. Earned forever. Non-transferable.</p>
      </div>

      {!loaded ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-shimmer rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* All Achievements */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a, i) => (
              <div
                key={a.id}
                className={`group relative card-surface rounded-xl p-6 text-center transition-all hover:scale-[1.02] animate-in fade-in ${
                  a.earned ? "border-primary glow-gold" : "opacity-50"
                }`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className={`mb-4 text-5xl transition-transform group-hover:rotate-[5deg] ${a.earned ? "" : "blur-[2px]"}`}>
                  {a.icon}
                </div>
                <h3 className="font-display text-base font-bold text-foreground">{a.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
                {a.earned ? (
                  <div className="mt-3">
                    <p className="text-xs text-primary">Earned: {a.earnedDate}</p>
                    <a href="#" className="text-xs text-primary underline mt-1 inline-block">
                      View on WireFluid Explorer →
                    </a>
                  </div>
                ) : (
                  <div className="mt-3">
                    <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">LOCKED</span>
                    <p className="mt-2 text-xs text-muted-foreground">Criteria: {a.criteria}</p>
                  </div>
                )}
                {!a.earned && (
                  <div className="absolute inset-0 rounded-xl bg-background/30" />
                )}
              </div>
            ))}
          </div>

          {/* Achievement Progress */}
          <div className="mt-12">
            <h2 className="mb-4 font-display text-lg font-semibold text-foreground">Achievement Progress</h2>
            <div className="space-y-4">
              {locked
                .filter((a) => a.progress !== undefined)
                .map((a) => (
                  <div key={a.id} className="card-surface rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{a.icon}</span>
                        <span className="text-sm font-medium text-foreground">{a.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {a.progress}/{a.maxProgress}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${((a.progress || 0) / (a.maxProgress || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
