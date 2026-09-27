interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorView({ message, onRetry }: Props) {
  return (
    <div className="empty-state">
      <svg className="empty-state-icon" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <h3>데이터를 불러오지 못했습니다</h3>
      <p>{message ?? "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요."}</p>
      {onRetry && <button className="empty-cta" onClick={onRetry}>다시 시도</button>}
    </div>
  );
}
