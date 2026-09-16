/**
 * 최소 안전 버전 결정 로직 (PRD §6.3).
 *
 * 네트워크와 분리해 둔 이유는 이 부분이 판단의 핵심이라 그 자체로 검사가 필요하기 때문이다.
 * 검사는 versions.test.ts에 있다(`npm run check --workspace @vibeguard/advisory-mcp`).
 *
 * 여기서 정답을 하나로 정하지 않는다. "메이저를 넘지 않는 상향"과 "전부 막는 상향"을
 * 둘 다 계산해 돌려주고, 어느 쪽을 택할지는 Agent 2가 판단한다(PRD §6.3).
 */

/**
 * 버전 문자열을 숫자 조각으로 나눈다. `1.26.18` → [1, 26, 18].
 *
 * ponytail: PEP 440의 epoch(`1!`)·post·dev는 다루지 않는다. 실제 매니페스트에
 * 그런 버전이 나와 비교가 틀리는 것이 확인되면 그때 라이브러리를 붙인다.
 */
function parts(version: string): { numbers: number[]; hasSuffix: boolean } {
  const trimmed = version.trim().replace(/^v/, '')
  const head = trimmed.match(/^[0-9]+(\.[0-9]+)*/)?.[0] ?? '0'
  return {
    numbers: head.split('.').map(Number),
    // 1.26.0rc1처럼 숫자 뒤에 뭔가 붙으면 정식 배포(1.26.0)보다 앞선 것으로 본다.
    hasSuffix: head.length < trimmed.length,
  }
}

/** a가 b보다 작으면 음수, 같으면 0, 크면 양수. */
export function compareVersions(a: string, b: string): number {
  const left = parts(a)
  const right = parts(b)
  const length = Math.max(left.numbers.length, right.numbers.length)
  for (let i = 0; i < length; i += 1) {
    const diff = (left.numbers[i] ?? 0) - (right.numbers[i] ?? 0)
    if (diff !== 0) return diff
  }
  if (left.hasSuffix === right.hasSuffix) return 0
  return left.hasSuffix ? -1 : 1
}

/** 메이저 번호. `1.24.1` → 1. */
export function major(version: string): number {
  return parts(version).numbers[0] ?? 0
}

/**
 * Trivy의 `fixedVersion`은 `"2.0.6, 1.26.17"`처럼 쉼표로 여러 개가 올 수 있다(실측).
 * 나눠 읽는 것은 러너가 아니라 여기 몫으로 정해져 있다.
 */
export function parseFixedVersions(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((one) => one.trim())
    .filter((one) => one.length > 0)
}

/** 취약점 하나와 그 취약점을 고친 버전들. */
export interface VulnFix {
  id: string
  aliases?: string[]
  summary?: string
  severity?: string
  fixedVersions: string[]
}

export interface Resolution {
  current: string
  /** 메이저를 넘지 않는 상향. 이 버전으로도 남는 취약점은 unresolved에 적는다. */
  withinMajor: { version: string | null; unresolved: string[] }
  /** 알려진 취약점을 전부 막는 상향. 고친 버전이 없는 취약점은 unfixable에 적는다. */
  fixesAll: { version: string | null; majorJump: boolean; unfixable: string[] }
  /** 기본 추천: 메이저를 넘지 않는 쪽을 먼저 본다(하위 호환 우선). */
  recommended: string | null
  majorJump: boolean
  perVuln: {
    id: string
    severity?: string
    minimalFix: string | null
    minimalFixWithinMajor: string | null
  }[]
}

/**
 * 현재 버전과 취약점 목록에서 상향 후보를 계산한다.
 *
 * 각 취약점을 막는 "현재보다 높은 가장 낮은 버전"을 구하고, 그중 가장 높은 것이
 * 전체를 막는 버전이다. 메이저를 넘지 않는 계산도 같은 방식으로 따로 한다.
 */
export function resolveFixedVersion(current: string, vulns: VulnFix[]): Resolution {
  const currentMajor = major(current)
  const ascending = (list: string[]) => [...list].sort(compareVersions)

  const perVuln = vulns.map((vuln) => {
    // 이미 지나온 버전은 후보가 아니다. 같은 취약점에 여러 계열의 수정본이 있을 수 있다.
    const upgrades = ascending(vuln.fixedVersions).filter((fix) => compareVersions(fix, current) > 0)
    return {
      id: vuln.id,
      severity: vuln.severity,
      minimalFix: upgrades[0] ?? null,
      minimalFixWithinMajor: upgrades.find((fix) => major(fix) === currentMajor) ?? null,
    }
  })

  const highest = (list: (string | null)[]) => {
    const known = list.filter((one): one is string => one !== null)
    return known.length > 0 ? ascending(known)[known.length - 1] : null
  }

  const withinMajorVersion = highest(perVuln.map((one) => one.minimalFixWithinMajor))
  const fixesAllVersion = highest(perVuln.map((one) => one.minimalFix))

  const recommended = withinMajorVersion ?? fixesAllVersion
  return {
    current,
    withinMajor: {
      version: withinMajorVersion,
      // 메이저 안에 수정본이 없는 취약점은 이 선택에서 남는다. 남는 것을 감추지 않는다.
      unresolved: perVuln.filter((one) => one.minimalFixWithinMajor === null && one.minimalFix !== null).map((one) => one.id),
    },
    fixesAll: {
      version: fixesAllVersion,
      majorJump: fixesAllVersion !== null && major(fixesAllVersion) > currentMajor,
      // 아직 고친 버전이 나오지 않은 취약점. 상향으로는 못 막는다.
      unfixable: perVuln.filter((one) => one.minimalFix === null).map((one) => one.id),
    },
    recommended,
    majorJump: recommended !== null && major(recommended) > currentMajor,
    perVuln,
  }
}
