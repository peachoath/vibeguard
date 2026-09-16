/**
 * versions.ts 자체 검사. 네트워크·도커 없이 돈다.
 * 실행: npm run check --workspace @vibeguard/advisory-mcp
 */
import assert from 'node:assert/strict'
import { compareVersions, major, parseFixedVersions, resolveFixedVersion } from './versions.js'

// 버전 비교는 사전순이 아니라 숫자순이어야 한다. 1.26.9 < 1.26.18 이 뒤집히면
// "안전 버전보다 높다"는 판정이 통째로 틀린다.
assert.ok(compareVersions('1.26.9', '1.26.18') < 0)
assert.ok(compareVersions('2.0.0', '1.26.18') > 0)
assert.equal(compareVersions('2.0', '2.0.0'), 0)
assert.ok(compareVersions('1.26.0rc1', '1.26.0') < 0)
assert.equal(major('1.24.1'), 1)

assert.deepEqual(parseFixedVersions('2.0.6, 1.26.17'), ['2.0.6', '1.26.17'])
assert.deepEqual(parseFixedVersions(null), [])

// urllib3 1.24.1 실측을 본뜬 사례(§8). 세 취약점의 수정본이 계열별로 흩어져 있다.
const resolution = resolveFixedVersion('1.24.1', [
  { id: 'CVE-2019-11324', fixedVersions: ['1.24.2'], severity: 'HIGH' },
  { id: 'CVE-2024-37891', fixedVersions: ['1.26.19', '2.2.2'] },
  { id: 'CVE-2025-66471', fixedVersions: ['2.6.0'] },
  { id: 'CVE-9999-0000', fixedVersions: [] }, // 아직 고친 버전이 없는 취약점
])

// 1.x 안에서 가장 높은 최소 수정본. 2.x로만 고쳐진 취약점은 남는다고 밝혀야 한다.
assert.equal(resolution.withinMajor.version, '1.26.19')
assert.deepEqual(resolution.withinMajor.unresolved, ['CVE-2025-66471'])

// 전부 막으려면 메이저를 넘어야 한다.
assert.equal(resolution.fixesAll.version, '2.6.0')
assert.equal(resolution.fixesAll.majorJump, true)
assert.deepEqual(resolution.fixesAll.unfixable, ['CVE-9999-0000'])

// 기본 추천은 하위 호환 우선이라 메이저를 넘지 않는다.
assert.equal(resolution.recommended, '1.26.19')
assert.equal(resolution.majorJump, false)

// 현재 버전보다 낮은 수정본은 후보가 아니다(이미 지나온 버전).
const already = resolveFixedVersion('2.0.0', [{ id: 'X', fixedVersions: ['1.26.18'] }])
assert.equal(already.recommended, null)
assert.deepEqual(already.fixesAll.unfixable, ['X'])

console.log('통과: 버전 비교와 최소 안전 버전 결정이 약속대로 동작한다.')
