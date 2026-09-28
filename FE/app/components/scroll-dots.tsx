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
    let wheelDelta = 0;
    let transitionLocked = false;
    let unlockTimer: number | undefined;

    const releaseTransition = () => {
      transitionLocked = false;
      if (unlockTimer) window.clearTimeout(unlockTimer);
      unlockTimer = undefined;
    };

    const getSectionTops = () => DOTS.map(({ id }, index) => {
      if (index === 0) return 0;
      const section = document.getElementById(id);
      return section ? section.getBoundingClientRect().top + window.scrollY : index * window.innerHeight;
    });

    const getNearestSection = (tops: number[]) => tops.reduce(
      (nearest, top, index) => Math.abs(top - window.scrollY) < Math.abs(tops[nearest] - window.scrollY) ? index : nearest,
      0,
    );

    const update = () => {
      setActive(getNearestSection(getSectionTops()));
    };

    const moveByWheel = (event: WheelEvent) => {
      if (window.innerWidth <= 960 || event.ctrlKey) return;

      event.preventDefault();
      if (transitionLocked) return;

      wheelDelta += event.deltaY;
      if (Math.abs(wheelDelta) < 12) return;

      const tops = getSectionTops();
      const current = getNearestSection(tops);
      const next = Math.max(0, Math.min(tops.length - 1, current + (wheelDelta > 0 ? 1 : -1)));
      wheelDelta = 0;

      if (next === current) return;

      transitionLocked = true;
      setActive(next);
      window.scrollTo({
        top: tops[next],
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });

      unlockTimer = window.setTimeout(releaseTransition, 1200);
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("scrollend", releaseTransition);
    window.addEventListener("wheel", moveByWheel, { passive: false });
    update();

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("scrollend", releaseTransition);
      window.removeEventListener("wheel", moveByWheel);
      if (unlockTimer) window.clearTimeout(unlockTimer);
    };
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
