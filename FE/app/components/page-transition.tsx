"use client";

import { Global, css } from "@emotion/react";
import { useSyncExternalStore, type ReactNode } from "react";
import { LayoutGroup } from "motion/react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function PageTransition({ children }: { children: ReactNode }) {
  // Keep Emotion's runtime style tags out of streamed server HTML.
  // The server and first hydration render both contain only the page content.
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return (
    <LayoutGroup id="dashboard-navigation">
      {hydrated && <Global styles={css`
        @media (prefers-reduced-motion: reduce) {
          .screen-content { transform: none !important; }
        }
      `} />}
      {children}
    </LayoutGroup>
  );
}
