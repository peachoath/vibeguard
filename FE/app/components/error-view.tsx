import { AlertTriangle } from "lucide-react";
import { EmptyState } from "./empty-state";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorView({ message, onRetry }: Props) {
  return (
    <EmptyState
      tone="danger"
      icon={<AlertTriangle size={28} />}
      title="데이터를 불러오지 못했습니다"
      description={message ?? "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요."}
      action={onRetry ? <button className="empty-cta" onClick={onRetry}>다시 시도</button> : undefined}
    />
  );
}
