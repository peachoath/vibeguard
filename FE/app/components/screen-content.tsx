"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export default function ScreenContent({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="screen-content"
      initial={{ x: 36 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 23, mass: .9 }}
    >
      {children}
    </motion.div>
  );
}
