import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  size?: "sm" | "md";
  tone?: "default" | "positive" | "danger";
};

/** 페이지 전반의 빈 상태/결과 없음/오류 표시를 통일하는 공용 컴포넌트. */
export function EmptyState({ icon, title, description, action, size = "md", tone = "default" }: Props) {
  return (
    <div className={`empty-state${size === "sm" ? " empty-state-sm" : ""}`}>
      <span className={`empty-state-illus tone-${tone}`} aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
