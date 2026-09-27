import { CSSProperties } from "react";

interface SkProps {
  w?: string | number;
  h?: string | number;
  r?: number | string;
  style?: CSSProperties;
}

export function Sk({ w = "100%", h = 16, r = 6, style }: SkProps) {
  return (
    <span
      className="sk"
      style={{ width: w, height: h, borderRadius: r, display: "block", ...style }}
      aria-hidden="true"
    />
  );
}
