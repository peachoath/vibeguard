const MESSAGES: Record<string, string> = {
  RUNNER_TIMEOUT:     '에이전트가 시간 초과됐어요. 리포지토리가 너무 크거나 네트워크가 불안정해요.',
  CLONE_FAILED:       '리포지토리를 클론하지 못했어요. 접근 권한이나 URL을 확인해주세요.',
  SCAN_FAILED:        '취약점 탐색 중 오류가 발생했어요.',
  PATCH_FAILED:       '자동 패치 적용에 실패했어요.',
  REGRESSION_BLOCKED: '패치 후 테스트가 실패해서 PR 생성이 중단됐어요.',
  INTERNAL_ERROR:     '내부 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
  PR_CREATE_FAILED:   'PR 생성에 실패했어요. GitHub 토큰 권한을 확인해주세요.',
  AUTH_FAILED:        'GitHub 인증이 만료됐어요. 다시 로그인해주세요.',
}

export function getErrorMessage(code: string | null | undefined): string {
  if (!code) return '알 수 없는 오류가 발생했어요.'
  return MESSAGES[code] ?? `오류 코드: ${code}`
}
