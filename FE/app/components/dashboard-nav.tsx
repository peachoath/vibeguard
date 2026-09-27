"use client";

import { motion, useReducedMotion } from "motion/react";

const tabs = [
  { id: "repositories", label: "저장소" },
  { id: "scan", label: "검사" },
  { id: "results", label: "분석 결과" },
  { id: "history", label: "검사 이력" },
  { id: "dashboard", label: "대시보드" },
];

export default function DashboardNav({ active }: { active: "repositories" | "scan" | "results" | "history" | "dashboard" }) {
  const reducedMotion = useReducedMotion();
  return (
    <nav className="dashboard-nav" aria-label="대시보드 메뉴">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const content = (
          <>
          {isActive && (
            <motion.span
              className="dashboard-tab-indicator"
              layoutId="dashboard-active-tab"
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 28, mass: .8 }}
              aria-hidden="true"
            />
          )}
          <span className="dashboard-tab-label">{tab.label}</span>
          </>
        );

        return <span key={tab.id} className={`dashboard-tab${isActive ? " active" : ""}`} aria-current={isActive ? "page" : undefined}>{content}</span>;
      })}
    </nav>
  );
}
