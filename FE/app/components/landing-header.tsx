"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import LoginModalTrigger from "./login-modal-trigger";

export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const track = () => {
      setScrolled(window.scrollY > 36);

      const ids = ["pr-example", "how-it-works"];
      let found = "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 80) found = id;
      }
      setActiveId(found);
    };

    window.addEventListener("scroll", track, { passive: true });
    track();
    return () => window.removeEventListener("scroll", track);
  }, []);

  const isHiw = activeId === "how-it-works" || activeId === "pr-example";

  return (
    <header className={`site-header${scrolled ? " site-header--scrolled" : ""}`}>
      <a className="brand" href="#top" aria-label="Vibe Guard 홈">
        <Image src="/vibeguard_logo_1.png" alt="Vibe Guard" width={452} height={170} priority />
      </a>
      <nav aria-label="주요 메뉴">
        <a href="#how-it-works" className={isHiw ? "nav-active" : ""}>제품</a>
        <a href="#how-it-works" className={isHiw ? "nav-active" : ""}>보안 원리</a>
        <a href="#docs">문서</a>
        <LoginModalTrigger />
      </nav>
    </header>
  );
}
