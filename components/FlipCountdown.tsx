'use client';

import { useEffect, useState } from "react";

interface FlipCountdownProps {
  targetDate: Date;
  className?: string;
}

export default function FlipCountdown({ targetDate, className = "" }: FlipCountdownProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, targetDate.getTime() - Date.now());
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const Digit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-lg bg-muted font-display text-2xl font-bold text-foreground overflow-hidden sm:h-16 sm:w-16 sm:text-3xl">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        {String(value).padStart(2, "0")}
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Digit value={timeLeft.days} label="Days" />
      <span className="text-xl font-bold text-muted-foreground pb-4">:</span>
      <Digit value={timeLeft.hours} label="Hrs" />
      <span className="text-xl font-bold text-muted-foreground pb-4">:</span>
      <Digit value={timeLeft.minutes} label="Min" />
      <span className="text-xl font-bold text-muted-foreground pb-4">:</span>
      <Digit value={timeLeft.seconds} label="Sec" />
    </div>
  );
}
