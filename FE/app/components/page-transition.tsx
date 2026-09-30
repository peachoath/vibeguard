"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { LayoutGroup } from "motion/react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function PageTransition({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return (
    <LayoutGroup id="dashboard-navigation">
      {hydrated && (
        <style>{`@media (prefers-reduced-motion: reduce) { .screen-content { transform: none !important; } }`}</style>
      )}
      <div id="main-content" tabIndex={-1} className="app-main-target">{children}</div>
    </LayoutGroup>
  );
}
