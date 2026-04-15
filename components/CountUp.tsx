'use client';

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export default function CountUp({ end, duration = 2000, prefix = "", suffix = "", decimals = 2, className = "" }: CountUpProps) {
  const [value, setValue] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const previousValueRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(end)) {
      setValue(0);
      previousValueRef.current = 0;
      return;
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startValue = previousValueRef.current;
    const delta = end - startValue;

    if (duration <= 0 || delta === 0) {
      setValue(end);
      previousValueRef.current = end;
      return;
    }

    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + delta * eased;

      setValue(nextValue);
      previousValueRef.current = nextValue;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(tick);
      } else {
        previousValueRef.current = end;
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [end, duration]);

  return (
    <span className={className}>
      {prefix}{value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}
