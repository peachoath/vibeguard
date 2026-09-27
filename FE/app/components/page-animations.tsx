"use client";
import { useEffect } from "react";

export default function PageAnimations() {
  useEffect(() => {
    document.body.classList.add("js-anim");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("anim-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    document
      .querySelectorAll(".feature-card, .hiw-step, .pre-card, .verification-panel")
      .forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  return null;
}
