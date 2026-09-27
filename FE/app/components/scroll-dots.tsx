"use client";
import { useEffect, useState } from "react";

const DOTS = [
  { id: "top", label: "홈" },
  { id: "how-it-works", label: "작동 방식" },
  { id: "pr-example", label: "PR 예시" },
];

export default function ScrollDots() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const update = () => {
      const vh = window.innerHeight;
      const sy = window.scrollY;
      if (sy < vh * 0.6) setActive(0);
      else if (sy < vh * 1.6) setActive(1);
      else setActive(2);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <nav className="scroll-dots" aria-label="섹션 탐색">
      {DOTS.map((d, i) => (
        <a
          key={d.id}
          href={`#${d.id}`}
          className={`scroll-dot${i === active ? " active" : ""}`}
          aria-label={d.label}
        />
      ))}
    </nav>
  );
}
