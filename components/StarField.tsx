'use client';

import { useState, useEffect } from "react";

interface Star {
  id: number;
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
}

export default function StarField() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    // Generate random values only on the client side after hydration
    const generatedStars = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 4 + 2,
      delay: Math.random() * 5,
    }));
    setStars(generatedStars);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-foreground/80 animate-twinkle"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            ["--twinkle-duration" as string]: `${s.duration}s`,
            ["--twinkle-delay" as string]: `${s.delay}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
