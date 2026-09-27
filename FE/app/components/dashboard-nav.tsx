"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

const tabs = [
  { id: "repositories", label: "저장소", href: "/repositories" },
  { id: "scan",         label: "검사",   href: "/scan" },
  { id: "results",      label: "분석 결과", href: "/results" },
  { id: "history",      label: "검사 이력", href: "/history" },
  { id: "dashboard",    label: "대시보드", href: "/dashboard" },
] as const;

type NavTab = typeof tabs[number]["id"];

export default function DashboardNav({ active }: { active: NavTab }) {
  const reducedMotion = useReducedMotion();
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
