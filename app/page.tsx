"use client";

import CountUp from "@/components/CountUp";
import PlayerCard from "@/components/PlayerCard";
import SkeletonCard from "@/components/SkeletonCard";
import StarField from "@/components/StarField";
import { PLAYERS } from "@/config/players";
import { useGetPrizePool } from "@/hooks/useContract";
import Link from "next/link";
import { useEffect, useState } from "react";

const HERO_PLAYERS = PLAYERS.slice(0, 3);

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const { matchPool } = useGetPrizePool();

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
        <StarField />
        {/* Gradient orbs */}
        <div className="pointer-events-none absolute left-1/4 top-1/3 h-[400px] w-[400px] animate-float rounded-full bg-primary/20 blur-[120px]" />
        <div
          className="pointer-events-none absolute right-1/4 top-1/2 h-[350px] w-[350px] rounded-full bg-secondary/20 blur-[120px]"
          style={{
            animationDelay: "3s",
            animation: "float 8s ease-in-out infinite",
          }}
        />

        <div
          className="relative z-10 text-center animate-in fade-in slide-in-from-bottom-8 duration-800"
          style={{ animationDelay: "0.2s" }}
        >
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
            🏏 Entangled Hackathon 2026 — Powered by WireFluid
          </span>

          <h1 className="mt-6 font-display text-5xl font-bold leading-tight text-foreground sm:text-6xl lg:text-[64px]">
            Own the Game.
            <br />
            Trade <span className="text-gold-gradient">PSL Stars.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Pakistan's first on-chain fantasy cricket market. Buy player tokens.
            Stake before matches. Earn from performance — daily, transparently,
            on WireFluid blockchain.
          </p>

          <div className="mt-8 flex flex-col items-center">
            <span className="text-sm uppercase tracking-wider text-muted-foreground">
              Daily Prize Pool
            </span>
            <div className="mt-1 text-4xl font-bold text-primary font-display sm:text-5xl">
              <CountUp
                end={matchPool > 0 ? matchPool : 12500}
                prefix=""
                suffix=" WC"
                decimals={0}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/market"
              className="bg-gold-gradient rounded-xl px-8 py-3 text-base font-semibold text-primary-foreground transition-transform hover:scale-105 shadow-lg"
            >
              Enter Market
            </Link>
            <a
              href="#how-it-works"
              className="rounded-xl border border-border px-8 py-3 text-base font-semibold text-foreground transition-colors hover:bg-muted"
            >
              How It Works
            </a>
          </div>
        </div>

        {/* Floating player cards */}
        <div
          className="relative z-10 mt-16 grid w-full max-w-4xl grid-cols-1 gap-4 px-4 sm:grid-cols-3 animate-in fade-in slide-in-from-bottom-12 duration-1000"
          style={{ animationDelay: "0.5s" }}
        >
          {!loaded
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            : HERO_PLAYERS.map((p, i) => (
                <PlayerCard key={p.id} player={p} index={i} />
              ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="mb-12 text-center font-display text-3xl font-bold text-foreground sm:text-4xl">
            How It Works
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: "🔍",
                title: "Browse Players",
                desc: "Explore 40 tokenized PSL players across 8 teams. Each player is a real ERC-20 on WireFluid.",
              },
              {
                icon: "💰",
                title: "Buy Tokens",
                desc: "Tokens priced via sigmoid bonding curve — early buyers get the best price. Max 10 tokens per player per wallet.",
              },
              {
                icon: "🏆",
                title: "Earn Daily",
                desc: "Stake before each match. Top performers earn you WireCoins from the daily prize pool, distributed automatically by smart contract.",
              },
            ].map((step, i) => (
              <div
                key={i}
                className="card-surface rounded-xl p-6 text-center transition-all hover:translate-y-[-4px]"
              >
                <div className="text-4xl mb-3">{step.icon}</div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 border-t border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { label: "Active Players", value: "40+" },
              { label: "Teams", value: "8" },
              {
                label: "Prize Pool",
                value: `${
                  matchPool > 0 ? matchPool.toLocaleString() : "125K"
                } WC`,
              },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl font-bold text-primary font-display">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
