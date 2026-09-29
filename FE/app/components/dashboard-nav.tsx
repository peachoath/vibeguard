"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { usePrefetch } from "@/lib/queries";

const tabs = [
  { id: "repositories", label: "저장소", href: "/repositories" },
  { id: "results",      label: "분석 결과", href: "/results" },
  { id: "history",      label: "검사 이력", href: "/history" },
  { id: "dashboard",    label: "대시보드", href: "/dashboard" },
] as const;

// "scan"은 저장소 선택 후 진입하는 액션 흐름이라 탭으로 노출하지 않지만,
// scan 페이지가 active="scan"으로 헤더를 렌더하므로 타입에는 유지한다.
type NavTab = typeof tabs[number]["id"] | "scan";

export default function DashboardNav({ active }: { active: NavTab }) {
  const reducedMotion = useReducedMotion();
  const prefetch = usePrefetch();
  const prefetchFor = (id: (typeof tabs)[number]["id"]) => {
    if (id === "repositories") prefetch.repositories();
    else if (id === "history") prefetch.history();
    else if (id === "dashboard") prefetch.dashboard();
    // results는 scanId가 있어야 조회 가능하므로 프리페치 생략
  };
  return (
    <nav className="dashboard-nav" aria-label="대시보드 메뉴">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            scroll={false}
            className={`dashboard-tab${isActive ? " active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onMouseEnter={() => prefetchFor(tab.id)}
            onFocus={() => prefetchFor(tab.id)}
          >
            {isActive && (
              <motion.span
                className="dashboard-tab-indicator"
                layoutId="dashboard-active-tab"
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 28, mass: 0.8 }
                }
                aria-hidden="true"
              />
            )}
            <span className="dashboard-tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
