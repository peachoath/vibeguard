const ACTIVE_SCAN_STATUSES = new Set([
  "QUEUED",
  "CLONING",
  "SCANNING",
  "VERIFYING",
  "REGRESSION_CHECK",
  "PR_CREATING",
]);

const FAILURE_SCAN_STATUSES = new Set([
  "FAILED",
  "PATCH_FAILED",
  "AGENT_NOT_CONFIGURED",
  "MCP_NOT_AVAILABLE",
  "INSTALL_FAILED",
]);

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "대기 중",
  CLONING: "저장소 복제 중",
  SCANNING: "취약점 탐지 중",
  VERIFYING: "위험도 검증 중",
  REGRESSION_CHECK: "회귀 검증 중",
  PR_CREATING: "PR 생성 중",
  COMPLETED: "완료",
  NO_FINDINGS: "발견 없음",
  PATCH_FAILED: "패치 실패",
  REGRESSION_BLOCKED: "회귀 차단",
  FAILED: "검사 실패",
  AGENT_NOT_CONFIGURED: "AI 설정 필요",
  MCP_NOT_AVAILABLE: "검증 도구 연결 실패",
  INSTALL_FAILED: "의존성 설치 실패",
  NO_TESTS: "테스트 없음",
};

export function isActiveScanStatus(status: string): boolean {
  return ACTIVE_SCAN_STATUSES.has(status);
}

export function isFailureScanStatus(status: string): boolean {
  return FAILURE_SCAN_STATUSES.has(status);
}

export function scanStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function scanStatusTone(status: string): "complete" | "blocked" | "failed" | "untested" {
  if (status === "COMPLETED" || status === "NO_FINDINGS") return "complete";
  if (status === "REGRESSION_BLOCKED") return "blocked";
  if (isFailureScanStatus(status)) return "failed";
  return "untested";
}

export function scanStatusFilterGroup(status: string): "complete" | "blocked" | "failed" | "waiting" {
  if (isActiveScanStatus(status)) return "waiting";
  const tone = scanStatusTone(status);
  return tone === "untested" ? "complete" : tone;
}
