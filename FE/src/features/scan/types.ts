export type ScanStatus =
  | 'QUEUED'
  | 'CLONING'
  | 'SCANNING'
  | 'VERIFYING'
  | 'REGRESSION_CHECK'
  | 'AWAITING_REVIEW'
  | 'PR_CREATING'
  | 'COMPLETED'
  | 'NO_FINDINGS'
  | 'PATCH_FAILED'
  | 'REGRESSION_BLOCKED'
  | 'FAILED'

export interface ScanDto {
  id: string
  repositoryId: string
  ref: string
  commitSha: string | null
  status: ScanStatus
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  errorCode: string | null
}

/** event: stage */
export interface SseStageEvent {
  scanId: string
  kind: 'stage'
  stage: string
  agent?: number
  status: 'RUNNING' | 'DONE' | 'FAILED'
  progress?: number
}

/** event: log */
export interface SseLogEvent {
  scanId: string
  kind: 'log'
  agent?: number
  level: 'INFO' | 'WARN' | 'ERROR'
  message: string
  ts: string
}

/** event: finding */
export interface SseFindingEvent {
  scanId: string
  kind: 'finding'
  findingId: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  // 인라인 확장 상세 (선택적 — BE가 포함 시 표시)
  cveId?: string
  packageName?: string
  affectedVersion?: string
  patchedVersion?: string
  cvssScore?: number
}

/** GET /api/v1/scans 목록 아이템 (이력 페이지) */
export interface ScanListItem extends ScanDto {
  repositoryFullName?: string
}

/** event: done */
export interface SseDoneEvent {
  scanId: string
  kind: 'done'
  status: string
  prUrl?: string
}
