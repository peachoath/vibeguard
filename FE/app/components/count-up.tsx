"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  to: number;
  duration?: number;
  delay?: number;
}

export default function CountUp({ to, duration = 720, delay = 0 }: Props) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fired.current) {
          fired.current = true;
          io.disconnect();
          setTimeout(() => {
            const t0 = performance.now();
            const tick = (now: number) => {
              const p = Math.min((now - t0) / duration, 1);
              const eased = 1 - Math.pow(1 - p, 3);
              setValue(Math.round(eased * to));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }, delay);
        }
      },
      { threshold: 0.5 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [to, duration, delay]);

  return <span ref={ref}>{value}</span>;
}
